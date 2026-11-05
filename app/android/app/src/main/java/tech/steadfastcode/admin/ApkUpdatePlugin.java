package tech.steadfastcode.admin;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.content.pm.SigningInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * Installing a new APK from inside the app (app/NATIVE.md, "Updates"), ported from Plumb's
 * ApkUpdatePlugin (2026-11-04), where the reasoning is written up in full.
 *
 * <p>The box publishes the APK to Cloudflare R2; the page downloads it natively with a short-lived
 * link and hands the bytes to Android's own {@link PackageInstaller}, which shows ITS confirmation
 * dialog (no code can remove that tap). Android refuses an update signed with a different key or
 * with a versionCode that isn't higher; the page checks both before downloading anything.
 *
 * <p>The status receiver is registered here, not in the manifest, so it exists only while the app
 * runs, and the confirmation dialog is started from the foreground Activity.
 */
@CapacitorPlugin(name = "ApkUpdate")
public class ApkUpdatePlugin extends Plugin {
    private static final String TAG = "SteadfastApk";
    private static final String ACTION_STATUS = "tech.steadfastcode.admin.APK_INSTALL_STATUS";
    private static final int BUFFER = 64 * 1024;

    private BroadcastReceiver statusReceiver;

    @Override
    public void load() {
        statusReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                handleStatus(intent);
            }
        };
        IntentFilter filter = new IntentFilter(ACTION_STATUS);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(statusReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(statusReceiver, filter);
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (statusReceiver != null) {
            try {
                getContext().unregisterReceiver(statusReceiver);
            } catch (IllegalArgumentException ignored) {
                // Already gone; nothing to do.
            }
            statusReceiver = null;
        }
    }

    /** What is installed right now: version, versionCode, signer, and whether we may install. */
    @PluginMethod
    public void currentVersion(PluginCall call) {
        try {
            PackageManager packages = getContext().getPackageManager();
            String name = getContext().getPackageName();
            PackageInfo info = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? packages.getPackageInfo(name, PackageManager.GET_SIGNING_CERTIFICATES)
                : packages.getPackageInfo(name, PackageManager.GET_SIGNATURES);
            JSObject result = new JSObject();
            result.put("versionName", info.versionName == null ? "" : info.versionName);
            // getLongVersionCode from API 28; the int field is the same number below that.
            result.put("versionCode", Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? info.getLongVersionCode() : info.versionCode);
            result.put("signerSha256", signerDigest(info));
            result.put("canInstall", canRequestInstalls());
            call.resolve(result);
        } catch (PackageManager.NameNotFoundException e) {
            call.reject("could not read this app's own package info", e);
        }
    }

    /**
     * Sends the person to Android's "install unknown apps" screen for this app. Nothing else can grant
     * it — REQUEST_INSTALL_PACKAGES in the manifest only makes the app eligible to ask.
     */
    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.resolve();
            return;
        }
        Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    /**
     * Hands a downloaded APK to Android. Resolves once the session is committed, which is BEFORE
     * the person has decided: the outcome arrives as an `apkInstallStatus` event, and a success
     * means this process is about to be replaced.
     *
     * @param call `path` — an absolute file path, as @capacitor/filesystem's downloadFile returns
     *             in `uri`; `sha256` — optional, verified before anything is handed over.
     */
    @PluginMethod
    public void installApk(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.isEmpty()) {
            call.reject("path is required");
            return;
        }
        File apk = new File(Uri.parse(path).getPath() == null ? path : Uri.parse(path).getPath());
        if (!apk.isFile()) {
            call.reject("no APK at " + apk.getAbsolutePath());
            return;
        }
        if (!canRequestInstalls()) {
            call.reject("Steadfast Code is not allowed to install apps yet — openInstallPermissionSettings first");
            return;
        }
        String expected = call.getString("sha256", "");
        if (expected != null && !expected.isEmpty()) {
            String actual = sha256(apk);
            if (!expected.equalsIgnoreCase(actual)) {
                call.reject("the downloaded APK does not match its manifest (" + actual + ")");
                return;
            }
        }

        PackageInstaller installer = getContext().getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        params.setAppPackageName(getContext().getPackageName());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // Keep the app's data (the sign-in) across the update.
            params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_UNSPECIFIED);
        }
        int sessionId;
        try {
            sessionId = installer.createSession(params);
        } catch (IOException e) {
            call.reject("could not open an install session", e);
            return;
        }

        try (PackageInstaller.Session session = installer.openSession(sessionId)) {
            try (InputStream in = Files.newInputStream(apk.toPath());
                 OutputStream out = session.openWrite("steadfast-code.apk", 0, apk.length())) {
                byte[] buffer = new byte[BUFFER];
                int read;
                while ((read = in.read(buffer)) > 0) out.write(buffer, 0, read);
                session.fsync(out);
            }
            Intent status = new Intent(ACTION_STATUS).setPackage(getContext().getPackageName());
            // Mutable: the system fills in EXTRA_STATUS and the confirmation Intent.
            int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0;
            PendingIntent pending = PendingIntent.getBroadcast(getContext(), sessionId, status, flags);
            session.commit(pending.getIntentSender());
            Log.i(TAG, "install session " + sessionId + " committed for " + apk.getName());
        } catch (IOException | RuntimeException e) {
            installer.abandonSession(sessionId);
            call.reject("could not write the APK into the install session", e);
            return;
        }
        JSObject result = new JSObject();
        result.put("committed", true);
        call.resolve(result);
    }

    // The system's answer. The first one is almost always PENDING_USER_ACTION, carrying the Intent
    // that shows the "Update Steadfast Code?" dialog; it is launched from the Activity, not from here, so it
    // is a foreground activity start and no background-launch restriction applies.
    private void handleStatus(Intent intent) {
        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, Integer.MIN_VALUE);
        String message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT);
            Activity activity = getActivity();
            if (confirm != null && activity != null) {
                confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                activity.startActivity(confirm);
                notify("pending-user-action", status, "Android is asking you to confirm the update.");
            } else {
                notify("failed", status, "Android asked for confirmation but the dialog could not be shown.");
            }
            return;
        }
        boolean ok = status == PackageInstaller.STATUS_SUCCESS;
        Log.i(TAG, "install status " + status + (message == null ? "" : ": " + message));
        notify(ok ? "success" : "failed", status, message == null ? (ok ? "Installed." : "The install did not complete.") : message);
    }

    private void notify(String outcome, int status, String message) {
        JSObject event = new JSObject();
        event.put("outcome", outcome);
        event.put("status", status);
        event.put("message", message);
        notifyListeners("apkInstallStatus", event, true);
    }

    private boolean canRequestInstalls() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true;
        return getContext().getPackageManager().canRequestPackageInstalls();
    }

    /** The SHA-256 of the installed app's signing certificate, lower-case hex, '' if unreadable. */
    private String signerDigest(PackageInfo info) {
        Signature[] signatures;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            SigningInfo signing = info.signingInfo;
            if (signing == null) return "";
            // The current signer: an app that has rotated its key reports history separately, and
            // what matters here is what an update has to match.
            signatures = signing.hasMultipleSigners() ? signing.getApkContentsSigners() : signing.getSigningCertificateHistory();
        } else {
            signatures = info.signatures;
        }
        if (signatures == null || signatures.length == 0) return "";
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return hex(digest.digest(signatures[0].toByteArray()));
        } catch (NoSuchAlgorithmException e) {
            return "";
        }
    }

    private String sha256(File file) {
        try (InputStream in = Files.newInputStream(file.toPath())) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[BUFFER];
            int read;
            while ((read = in.read(buffer)) > 0) digest.update(buffer, 0, read);
            return hex(digest.digest());
        } catch (IOException | NoSuchAlgorithmException e) {
            return "";
        }
    }

    private static String hex(byte[] bytes) {
        StringBuilder out = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) out.append(String.format("%02x", b));
        return out.toString();
    }
}
