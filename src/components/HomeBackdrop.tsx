/**
 * HomeBackdrop — large-scale abstract liquid background field for the
 * Bislig Hub customer home dashboard.
 *
 * One coherent system (5 layers): soft atmospheric mass, primary
 * translucent liquid form, darker edge ribbon, blurred secondary form,
 * and a single restrained Bislig-orange accent. Right-weighted so the
 * left hero copy stays readable; extends the full page height.
 *
 * Background only: pointer-events none, sits behind all UI, no layout
 * impact, no business logic.
 */
export function HomeBackdrop() {
  return (
    <div className="home-backdrop" aria-hidden="true">
      <svg
        className="home-backdrop__svg"
        viewBox="0 0 1440 1900"
        preserveAspectRatio="xMaxYMin slice"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <filter id="hb-blur-80" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="80" />
          </filter>
          <filter id="hb-blur-55" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="55" />
          </filter>
          <filter id="hb-blur-10" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
        </defs>

        {/* Layer 1 — soft atmospheric gray mass (extremely subtle base) */}
        <ellipse
          cx="1150"
          cy="330"
          rx="560"
          ry="400"
          fill="#E6EBEF"
          opacity="0.79"
          filter="url(#hb-blur-80)"
        />
        <ellipse
          cx="1240"
          cy="950"
          rx="480"
          ry="520"
          fill="#E9EEF1"
          opacity="0.62"
          filter="url(#hb-blur-80)"
        />

        {/* Layers 2–4 — drifting liquid composition */}
        <g className="home-backdrop__drift">
          {/* Layer 2 — primary translucent liquid form (right-weighted) */}
          <path
            d="M 1020 -120
               C 1290 40, 1420 260, 1355 520
               C 1290 780, 1105 860, 1040 1090
               C 975 1320, 1120 1520, 1035 1900
               L 1440 1900 L 1440 -120 Z"
            fill="#D4DCE2"
            opacity="0.55"
          />
          {/* Layer 2b — overlapping lighter lobe for tonal depth */}
          <path
            d="M 880 60
               C 1080 170, 1170 420, 1095 640
               C 1020 860, 855 960, 875 1220
               C 895 1480, 1010 1620, 960 1900
               L 1440 1900 L 1440 1540
               C 1300 1380, 1180 1180, 1210 940
               C 1240 700, 1120 420, 1000 240
               C 950 170, 910 110, 880 60 Z"
            fill="#CBD5DB"
            opacity="0.4"
          />

          {/* Layer 3 — darker translucent edge ribbon following the form */}
          <path
            d="M 1020 -120
               C 1290 40, 1420 260, 1355 520
               C 1290 780, 1105 860, 1040 1090
               C 975 1320, 1120 1520, 1035 1900"
            fill="none"
            stroke="#22343A"
            strokeWidth="36"
            strokeLinecap="round"
            opacity="0.14"
            filter="url(#hb-blur-10)"
          />
          {/* Thin editorial echo of the same edge */}
          <path
            d="M 978 -120
               C 1248 40, 1378 260, 1313 520
               C 1248 780, 1063 860, 998 1090
               C 933 1320, 1078 1520, 993 1900"
            fill="none"
            stroke="#22343A"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.11"
          />

          {/* Layer 3b — parallel flowing lines (editorial movement) */}
          <path
            d="M 1100 -120
               C 1300 120, 1360 380, 1280 600
               C 1200 820, 1080 920, 1050 1150
               C 1020 1380, 1110 1600, 1050 1900"
            fill="none"
            stroke="#22343A"
            strokeWidth="1.5"
            opacity="0.09"
          />
          <path
            d="M 1142 -120
               C 1342 120, 1402 380, 1322 600
               C 1242 820, 1122 920, 1092 1150
               C 1062 1380, 1152 1600, 1092 1900"
            fill="none"
            stroke="#22343A"
            strokeWidth="1.5"
            opacity="0.07"
          />
          <path
            d="M 1184 -120
               C 1384 120, 1444 380, 1364 600
               C 1284 820, 1164 920, 1134 1150
               C 1104 1380, 1194 1600, 1134 1900"
            fill="none"
            stroke="#22343A"
            strokeWidth="1.5"
            opacity="0.05"
          />
        </g>

        {/* Layer 4 — soft blurred secondary form (lower field) */}
        <ellipse
          cx="950"
          cy="1520"
          rx="420"
          ry="300"
          fill="#DCE3E8"
          opacity="0.44"
          filter="url(#hb-blur-55)"
        />
        {/* Faint lower-left wash so the field feels continuous, not cut off */}
        <ellipse
          cx="800"
          cy="1450"
          rx="320"
          ry="230"
          fill="#E9EEF1"
          opacity="0.62"
          filter="url(#hb-blur-55)"
        />

        {/* Layer 5 — single restrained Bislig-orange accent at the waist */}
        <path
          d="M 1258 560 C 1292 606, 1288 662, 1248 694"
          fill="none"
          stroke="#FF6B1A"
          strokeWidth="10"
          strokeLinecap="round"
          opacity="0.75"
        />
        <circle cx="1242" cy="702" r="7" fill="#FF6B1A" opacity="0.79" />
      </svg>
    </div>
  );
}
