package tech.steadfastcode.admin;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // In-app updates (ApkUpdatePlugin): registered before the bridge starts.
        registerPlugin(ApkUpdatePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
