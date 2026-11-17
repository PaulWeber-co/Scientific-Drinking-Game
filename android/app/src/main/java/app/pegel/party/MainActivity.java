package app.pegel.party;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /**
     * Obergrenze für die Systemschriftgröße in der WebView, in Prozent.
     *
     * Android skaliert Text in der WebView mit der Schriftgröße aus den
     * Einstellungen. Bis 115 % trägt das Layout; darüber laufen Titel aus ihren
     * Karten (Polaroid-Beschriftung, Tab-Leiste). Größer heißt hier: kaputt,
     * nicht lesbarer – darum gedeckelt statt ganz abgeschaltet.
     */
    private static final int MAX_TEXT_ZOOM = 115;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        applyTextZoom();
    }

    @Override
    public void onResume() {
        super.onResume();
        // Die Schriftgröße kann sich geändert haben, während die App im Hintergrund lag.
        applyTextZoom();
    }

    private void applyTextZoom() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        WebSettings settings = getBridge().getWebView().getSettings();
        int system = Math.round(getResources().getConfiguration().fontScale * 100);
        settings.setTextZoom(Math.min(system, MAX_TEXT_ZOOM));
    }
}
