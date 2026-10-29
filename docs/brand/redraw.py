# Redraws docs/brand/original.jpg (Daniel's logo, 960x960) as vectors: writes draft.svg (with the
# navy background, for comparing against the original) and logo.svg (transparent, cropped), which is
# public/logo.svg. Shapes come from measuring the original's outline; shading is flat facets in its
# sampled colors. Run: python3 docs/brand/redraw.py (in a scratch folder), then copy logo.svg over.
import math
c, s = math.cos(math.radians(24.3)), math.sin(math.radians(24.3))
O = (557, 335)
def L(lx, ly):  # anchor-local -> image
    return (O[0] + lx * c - ly * s, O[1] + lx * s + ly * c)
def f(p): return f'{p[0]:.0f} {p[1]:.0f}'

def smooth(pts, closed=False):
    """Catmull-Rom through pts, as cubic segments (assumes the pen is at pts[0])."""
    out = []
    n = len(pts)
    for i in range(n - 1):
        p0 = pts[i - 1] if i > 0 else pts[i]
        p1, p2 = pts[i], pts[i + 1]
        p3 = pts[i + 2] if i + 2 < n else p2
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        out.append(f'C{f(c1)} {f(c2)} {f(p2)}')
    return ' '.join(out)

def path(runs):
    """runs: list of point lists; corners between runs stay sharp."""
    d = f'M{f(runs[0][0])}'
    for i, r in enumerate(runs):
        if i > 0: d += f' L{f(r[0])}'
        d += ' ' + smooth(r) if len(r) > 1 else ''
    return d + ' Z'

shank_tl, shank_tr = L(-23, 2), L(22, 2)
shank_bl = (419, 585)   # left edge meets the left valley
shank_br = (465, 598)   # right edge meets the right valley fillet

body = path([
    [shank_tl, shank_bl, (402, 591), (387, 590)],                       # down the left edge into the left valley
    [(387, 590), (368, 582), (356, 574), (349, 566), (344, 558), (340, 550), (337, 542)],  # left arm, inner side, up to the neck
    [(364, 535)],                                                        # left fluke inner barb
    [(358, 526), (349, 510), (343, 494), (339, 478), (337, 462), (335, 449)],  # inner edge up to the tip
    [(335, 449), (324, 462), (310, 478), (300, 494), (294, 510), (290, 526), (288, 538)],  # outer edge down to the outer barb
    [(312, 543), (313, 552), (316, 566), (321, 582), (329, 598), (341, 614), (356, 630), (369, 646), (379, 662), (386, 678), (392, 696)],  # left arm outer, to the crown tip
    [(392, 696), (420, 684), (453, 680), (487, 675), (520, 667), (547, 657), (568, 643)],  # right arm underside, one smooth sweep
    [(572, 669)],                                                        # the spike under the fluke
    [(582, 645), (596, 635), (607, 618), (612, 597), (610, 575)],         # fluke outer edge up to the tip
    [(610, 575), (593, 588), (560, 600), (528, 610)],                    # fluke inner edge down to the barb point
    [(552, 628)],                                                        # barb back corner
    [(552, 628), (530, 636), (503, 639), (486, 631), (474, 614), (468, 592)],  # arm's top edge and the U into the shank
    [(468, 592), shank_tr],
])

# facets, clipped to the body
center_top, crown = L(0, -10), (392, 700)
left_half = f'M{f(L(-300,-60))} L{f(center_top)} L{f(crown)} L{f((392,760))} L{f((200,760))} Z'
dark_shank = f'M{f(center_top)} L{f(L(40,-10))} L{f((468,592))} L{f((474,614))} L{f((452,660))} L{f(crown)} Z'
left_fluke_dark = f'M{f((335,449))} L{f((323,498))} L{f((326,545))} L{f((337,544))} L{f((364,535))} L{f((349,505))} Z'
right_arm_low = f'M{f((392,700))} L{f((420,664))} L{f((520,652))} L{f((566,646))} L{f((576,675))} L{f((390,710))} Z'

stock = ('<g transform="translate(' + f(L(1, 88)) + ') rotate(28.5)">'
         '<rect x="-100" y="-23" width="200" height="23" fill="#66c1fe"/>'
         '<rect x="-100" y="0" width="200" height="23" fill="#2874fa"/>'
         '<rect x="-100" y="-5" width="200" height="10" fill="#4695fe"/>'
         '<g><rect x="-110" y="-27" width="32" height="28" rx="7" fill="#f99b1f"/><rect x="-110" y="-3" width="32" height="30" rx="7" fill="#e9481c"/><rect x="-110" y="-6" width="32" height="9" fill="#f27a1d"/></g>'
         '<g><rect x="78" y="-27" width="32" height="28" rx="7" fill="#f99b1f"/><rect x="78" y="-3" width="32" height="30" rx="7" fill="#e9481c"/><rect x="78" y="-6" width="32" height="9" fill="#f27a1d"/></g>'
         '</g>')
stock_shadow = '<g transform="translate(' + f(L(1, 88)) + ') rotate(28.5)"><rect x="-30" y="21" width="60" height="8" fill="#0b151f"/></g>'

rope = 'M580 470 C562 488 540 500 505 506 C465 512 430 524 412 543 C400 556 395 570 394 586'

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 960" width="960" height="960">
  <defs>
    <linearGradient id="bracket" x1="0" y1="375" x2="0" y2="590" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#6fc3f8"/><stop offset=".5" stop-color="#51a5fe"/><stop offset="1" stop-color="#3075f4"/></linearGradient>
    <linearGradient id="body" x1="600" y1="590" x2="520" y2="690" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#6bc2fd"/><stop offset=".45" stop-color="#57abfd"/><stop offset="1" stop-color="#3a80f9"/></linearGradient>
    <linearGradient id="light" x1="560" y1="330" x2="380" y2="690" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#7bd4fc"/><stop offset=".55" stop-color="#5fb4fb"/><stop offset="1" stop-color="#74d3fe"/></linearGradient>
    <linearGradient id="ring" x1="557" y1="286" x2="580" y2="384" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#72cbfd"/><stop offset=".5" stop-color="#4a95fa"/><stop offset="1" stop-color="#3077f7"/></linearGradient>
    <linearGradient id="rope" x1="580" y1="470" x2="394" y2="586" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#de5926"/><stop offset=".35" stop-color="#fa9e1b"/><stop offset=".7" stop-color="#f7861c"/><stop offset="1" stop-color="#eb4f19"/></linearGradient>
    <clipPath id="clip"><path d="{body}"/></clipPath>
  </defs>
  <rect width="960" height="960" fill="#0b151f"/>
  <path fill="url(#bracket)" d="M298 375 L128 465 L128 500 L298 590 L298 545 L186 482 L298 420 Z"/>
  <path fill="url(#bracket)" d="M657 375 L830 465 L830 500 L657 590 L657 545 L771 482 L657 420 Z"/>
  <path fill="url(#body)" d="{body}"/>
  <g clip-path="url(#clip)">
    <path fill="url(#light)" d="{left_half}"/>
    <path fill="#2a74fd" d="{dark_shank}"/>
    <path fill="#2f7afd" d="{left_fluke_dark}"/>
    {stock_shadow}
  </g>
  <circle cx="{O[0]}" cy="{O[1]}" r="39.5" fill="none" stroke="url(#ring)" stroke-width="19"/>
  {stock}
  <path d="{rope}" fill="none" stroke="#0b151f" stroke-width="17" transform="translate(1.5 2)" stroke-linecap="round"/>
  <path d="{rope}" fill="none" stroke="url(#rope)" stroke-width="11" stroke-linecap="round"/>
</svg>
'''
open('draft.svg', 'w').write(svg)
logo = svg.replace('viewBox="0 0 960 960" width="960" height="960"', 'viewBox="118 278 724 428"').replace('  <rect width="960" height="960" fill="#0b151f"/>\n', '')
logo = logo.replace('<svg xmlns="http://www.w3.org/2000/svg"', '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Steadfast Code"')
open('logo.svg', 'w').write(logo)
