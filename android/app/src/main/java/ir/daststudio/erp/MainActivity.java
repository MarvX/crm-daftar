package ir.daststudio.erp;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONTokener;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class MainActivity extends android.app.Activity {

    private static final int FILE_CHOOSER_REQUEST = 4101;
    private static final int CAMERA_PERMISSION_REQUEST = 4102;

    // Deep-link اختصاصی برای لمس تگ حضور دفتر
    private static final String ATTENDANCE_SCHEME = "daststudio";
    private static final String ATTENDANCE_HOST = "attendance";
    private static final String ATTENDANCE_PATH = "/office";

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private PermissionRequest pendingPermissionRequest;

    private FrameLayout root;
    private FrameLayout nfcOverlay;
    private TextView nfcIcon;
    private TextView nfcTitle;
    private TextView nfcDetail;

    private boolean pendingNfcAction = false;
    private boolean nfcLaunchedActivity = false;
    private int nfcAttempts = 0;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(Color.WHITE);
        getWindow().setNavigationBarColor(Color.WHITE);

        root = new FrameLayout(this);
        webView = new WebView(this);
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        nfcOverlay = createNfcOverlay();
        root.addView(nfcOverlay, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        nfcOverlay.setVisibility(View.GONE);

        setContentView(root);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " DastStudioAndroid/1.0");

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        webView.setWebViewClient(new AppWebViewClient());
        webView.setWebChromeClient(new AppWebChromeClient());
        webView.setDownloadListener(new AppDownloadListener());

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(BuildConfig.APP_URL);
        }

        requestNotificationPermission();

        if (isAttendanceIntent(getIntent())) {
            nfcLaunchedActivity = true;
            pendingNfcAction = true;
            nfcAttempts = 0;
            showNfcOverlay("در حال آماده‌سازی…", "تگ دفتر شناسایی شد");
            webView.postDelayed(this::tryNfcAttendance, 350);
        }
    }

    private FrameLayout createNfcOverlay() {
        FrameLayout overlay = new FrameLayout(this);
        overlay.setClickable(true);
        overlay.setBackgroundColor(0xF3141420);

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setGravity(Gravity.CENTER_HORIZONTAL);

        GradientDrawable cardBg = new GradientDrawable();
        cardBg.setColor(0xFF1E1C2C);
        cardBg.setCornerRadius(dp(28));
        cardBg.setStroke(dp(1), 0x445A52A6);
        card.setBackground(cardBg);
        card.setPadding(dp(30), dp(34), dp(30), dp(30));

        FrameLayout.LayoutParams cardLp = new FrameLayout.LayoutParams(
                dp(300),
                ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER
        );
        cardLp.setMargins(dp(24), dp(24), dp(24), dp(24));
        overlay.addView(card, cardLp);

        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.logo_white);
        logo.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        LinearLayout.LayoutParams logoLp = new LinearLayout.LayoutParams(dp(78), dp(78));
        logoLp.bottomMargin = dp(10);
        card.addView(logo, logoLp);

        nfcIcon = new TextView(this);
        nfcIcon.setText("⌁");
        nfcIcon.setTextColor(Color.WHITE);
        nfcIcon.setTextSize(34);
        nfcIcon.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams iconLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(52)
        );
        card.addView(nfcIcon, iconLp);

        nfcTitle = new TextView(this);
        nfcTitle.setTextColor(Color.WHITE);
        nfcTitle.setTextSize(20);
        nfcTitle.setGravity(Gravity.CENTER);
        nfcTitle.setTypeface(null, android.graphics.Typeface.BOLD);
        LinearLayout.LayoutParams titleLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
        );
        titleLp.topMargin = dp(4);
        card.addView(nfcTitle, titleLp);

        nfcDetail = new TextView(this);
        nfcDetail.setTextColor(0xFFBDB8D4);
        nfcDetail.setTextSize(13);
        nfcDetail.setGravity(Gravity.CENTER);
        nfcDetail.setLineSpacing(0f, 1.35f);
        LinearLayout.LayoutParams detailLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
        );
        detailLp.topMargin = dp(8);
        card.addView(nfcDetail, detailLp);

        TextView hint = new TextView(this);
        hint.setText("استودیو معماری دَست");
        hint.setTextColor(0xFF8178DC);
        hint.setTextSize(11);
        hint.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams hintLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
        );
        hintLp.topMargin = dp(18);
        card.addView(hint, hintLp);

        return overlay;
    }

    private void showNfcOverlay(String title, String detail) {
        if (nfcOverlay == null) return;
        nfcIcon.setText("⌁");
        nfcTitle.setText(title);
        nfcDetail.setText(detail);
        nfcOverlay.setVisibility(View.VISIBLE);
    }

    private void showNfcResult(boolean success, String title, String detail) {
        if (nfcOverlay == null) return;
        nfcIcon.setText(success ? "✓" : "!");
        nfcTitle.setText(title);
        nfcDetail.setText(detail);
        nfcOverlay.setVisibility(View.VISIBLE);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 &&
                checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 4103);
        }
    }

    private boolean isAttendanceIntent(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) return false;
        Uri data = intent.getData();
        if (data == null) return false;
        return ATTENDANCE_SCHEME.equalsIgnoreCase(data.getScheme())
                && ATTENDANCE_HOST.equalsIgnoreCase(data.getHost())
                && ATTENDANCE_PATH.equals(data.getPath());
    }

    private void handleNfcIntent(Intent intent, boolean fromColdStart) {
        if (!isAttendanceIntent(intent)) return;

        nfcLaunchedActivity = fromColdStart;
        pendingNfcAction = true;
        nfcAttempts = 0;
        showNfcOverlay("در حال ثبت…", "ورود و خروج شما در حال ثبت است");
        webView.postDelayed(this::tryNfcAttendance, 150);
    }

    private void tryNfcAttendance() {
        if (!pendingNfcAction || webView == null) return;

        if (nfcAttempts++ > 24) {
            pendingNfcAction = false;
            showNfcResult(false, "ثبت انجام نشد", "یک‌بار داخل اپ وارد حساب خودت شو و دوباره تگ را بزن.");
            finishAfterNfc(false);
            return;
        }

        final String script =
                "(async function(){"
                        + "try{"
                        + "if(!window.dastNfcAttendance){return 'retry|not_ready';}"
                        + "const r=await window.dastNfcAttendance();"
                        + "return (r&&r.ok?'ok|':'error|')+((r&&r.status)||'unknown');"
                        + "}catch(e){return 'error|exception';}"
                        + "})()";

        webView.evaluateJavascript(script, value -> {
            String result = decodeJsResult(value);

            if ("retry|not_ready".equals(result)) {
                webView.postDelayed(this::tryNfcAttendance, 300);
                return;
            }

            pendingNfcAction = false;
            handleNfcAttendanceResult(result);
        });
    }

    private String decodeJsResult(String value) {
        if (value == null || "null".equals(value)) return "";
        try {
            Object parsed = new JSONTokener(value).nextValue();
            return parsed == null ? "" : String.valueOf(parsed);
        } catch (Exception ignored) {
            if (value.length() >= 2 && value.startsWith(""") && value.endsWith(""")) {
                return value.substring(1, value.length() - 1)
                        .replace("\"", """)
                        .replace("\\\\", "\");
            }
            return value;
        }
    }

    private void handleNfcAttendanceResult(String result) {
        String[] parts = result.split("\\|", 2);
        String prefix = parts.length > 0 ? parts[0] : "";
        String status = parts.length > 1 ? parts[1] : "";

        if ("ok".equals(prefix)) {
            String title = "ثبت شد";
            if ("checked_in".equals(status)) title = "ورود ثبت شد ✓";
            else if ("checked_out".equals(status)) title = "خروج ثبت شد ✓";

            String time = new SimpleDateFormat("HH:mm", Locale.getDefault()).format(new Date());
            showNfcResult(true, title, "ساعت " + time + " · استودیو معماری دَست");
            finishAfterNfc(true);
            return;
        }

        if ("not_logged_in".equals(status)) {
            showNfcResult(false, "وارد حساب نیستی", "اول یک‌بار داخل اپ وارد شو؛ بعد برای ثبت حضور فقط تگ را لمس کن.");
        } else if ("busy".equals(status)) {
            showNfcResult(false, "ثبت قبلی هنوز در حال انجام است", "چند لحظه صبر کن و دوباره تگ را لمس کن.");
        } else if ("not_ready".equals(status)) {
            showNfcResult(false, "آماده نشد", "لطفاً دوباره تگ را لمس کن.");
        } else {
            showNfcResult(false, "ثبت انجام نشد", "اتصال یا وضعیت حضور و غیاب را دوباره بررسی کن.");
        }
        finishAfterNfc(false);
    }

    private void finishAfterNfc(boolean success) {
        long delay = success ? 1100L : 2200L;
        if (nfcLaunchedActivity) {
            webView.postDelayed(() -> {
                if (!isFinishing()) finish();
            }, delay);
        } else {
            webView.postDelayed(() -> {
                if (nfcOverlay != null) nfcOverlay.setVisibility(View.GONE);
            }, delay);
        }
    }

    private class AppWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return handleUrl(request.getUrl());
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return handleUrl(Uri.parse(url));
        }

        private boolean handleUrl(Uri uri) {
            String scheme = uri.getScheme();
            if (scheme == null) return false;

            if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
                return false;
            }

            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (Exception ignored) {
                Toast.makeText(MainActivity.this, "این لینک توسط دستگاه پشتیبانی نمی‌شود.", Toast.LENGTH_SHORT).show();
            }
            return true;
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            if (pendingNfcAction) {
                view.postDelayed(MainActivity.this::tryNfcAttendance, 250);
            }
        }
    }

    private class AppWebChromeClient extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(
                WebView webView,
                ValueCallback<Uri[]> callback,
                FileChooserParams params) {

            if (filePathCallback != null) {
                filePathCallback.onReceiveValue(null);
            }

            filePathCallback = callback;

            Intent intent = params.createIntent();
            intent.addCategory(Intent.CATEGORY_OPENABLE);

            try {
                startActivityForResult(intent, FILE_CHOOSER_REQUEST);
            } catch (Exception e) {
                filePathCallback = null;
                callback.onReceiveValue(null);
                Toast.makeText(MainActivity.this, "انتخاب فایل ممکن نشد.", Toast.LENGTH_SHORT).show();
            }
            return true;
        }

        @Override
        public void onPermissionRequest(final PermissionRequest request) {
            runOnUiThread(() -> {
                if (request == null) return;

                boolean wantsCamera = false;
                for (String resource : request.getResources()) {
                    if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                        wantsCamera = true;
                        break;
                    }
                }

                if (wantsCamera && Build.VERSION.SDK_INT >= 23 &&
                        checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                    pendingPermissionRequest = request;
                    requestPermissions(
                            new String[]{Manifest.permission.CAMERA},
                            CAMERA_PERMISSION_REQUEST
                    );
                    return;
                }

                request.grant(request.getResources());
            });
        }
    }

    private class AppDownloadListener implements DownloadListener {
        @Override
        public void onDownloadStart(
                String url,
                String userAgent,
                String contentDisposition,
                String mimeType,
                long contentLength) {

            try {
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                request.setMimeType(mimeType);
                request.addRequestHeader("User-Agent", userAgent);

                String cookies = CookieManager.getInstance().getCookie(url);
                if (cookies != null) {
                    request.addRequestHeader("Cookie", cookies);
                }

                request.setTitle("دریافت فایل");
                request.setDescription("در حال دانلود از استودیو معماری دَست");
                request.setNotificationVisibility(
                        DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED
                );
                request.setDestinationInExternalPublicDir(
                        Environment.DIRECTORY_DOWNLOADS,
                        "daststudio-download"
                );

                DownloadManager manager =
                        (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                if (manager != null) {
                    manager.enqueue(request);
                    Toast.makeText(MainActivity.this, "دانلود شروع شد.", Toast.LENGTH_SHORT).show();
                }
            } catch (Exception e) {
                Toast.makeText(MainActivity.this, "دانلود فایل انجام نشد.", Toast.LENGTH_SHORT).show();
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode,
            String[] permissions,
            int[] grantResults) {

        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == CAMERA_PERMISSION_REQUEST && pendingPermissionRequest != null) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                pendingPermissionRequest.grant(pendingPermissionRequest.getResources());
            } else {
                pendingPermissionRequest.deny();
            }
            pendingPermissionRequest = null;
        }
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode != FILE_CHOOSER_REQUEST || filePathCallback == null) {
            return;
        }

        Uri[] results = null;

        if (resultCode == RESULT_OK) {
            if (data != null) {
                if (data.getClipData() != null) {
                    int count = data.getClipData().getItemCount();
                    results = new Uri[count];
                    for (int i = 0; i < count; i++) {
                        results[i] = data.getClipData().getItemAt(i).getUri();
                    }
                } else if (data.getData() != null) {
                    results = new Uri[]{data.getData()};
                }
            }
        }

        filePathCallback.onReceiveValue(results);
        filePathCallback = null;
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleNfcIntent(intent, false);
    }

    @Override
    public void onBackPressed() {
        if (nfcOverlay != null && nfcOverlay.getVisibility() == View.VISIBLE && !nfcLaunchedActivity) {
            nfcOverlay.setVisibility(View.GONE);
            pendingNfcAction = false;
            return;
        }
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        if (webView != null) {
            webView.saveState(outState);
        }
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
