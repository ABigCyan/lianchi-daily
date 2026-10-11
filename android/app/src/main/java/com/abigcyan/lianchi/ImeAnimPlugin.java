package com.abigcyan.lianchi;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.os.Build;
import android.view.View;
import androidx.annotation.NonNull;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsAnimationCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.webkit.WebViewCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.List;
import java.util.Locale;

/**
 * 键盘动效：键盘弹出时不再让系统把整个 WebView 压扁重排（那一下会卡顿），
 * 而是把键盘高度和动画时长告诉页面，页面里的输入框、底部面板跟着键盘一起平滑上移。
 *
 * 做法（Android 11 及以上）：
 * 1. 接管窗口的 insets 监听：把键盘（IME）从 insets 里去掉，其余照 Capacitor SystemBars 的做法处理（安全区 CSS 变量、系统栏留白），
 *    这样 WebView 的大小始终不变；
 * 2. 监听键盘动画开始，把最终高度（扣掉导航栏，单位 CSS px）和时长交给页面的 window.__ime(高度, 毫秒)。
 * Android 10 及以下保持原来的做法（WebView 跟着键盘缩小）。
 * 设置里可以关掉（setSmooth），关掉后和 Capacitor 原来的做法完全一样；开关存在原生里，下次启动前就生效。
 */
@CapacitorPlugin(name = "ImeAnim")
public class ImeAnimPlugin extends Plugin {

    private static final int WEBVIEW_VERSION_WITH_SAFE_AREA_FIX = 140;
    private boolean active = false;
    private boolean animating = false;
    private int lastSent = -1;
    private boolean smooth = true;
    private View decorView;

    @Override
    public void load() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return;
        smooth = prefs().getBoolean("smooth", true);
        final View decor = getActivity().getWindow().getDecorView();
        decorView = decor;
        // SystemBars 在它自己的 load() 里设置了监听；等它设完再接管
        decor.post(() -> install(decor));
    }

    @PluginMethod
    public void info(PluginCall call) {
        JSObject r = new JSObject();
        r.put("supported", Build.VERSION.SDK_INT >= Build.VERSION_CODES.R);
        r.put("active", active && smooth);
        r.put("smooth", smooth);
        call.resolve(r);
    }

    @PluginMethod
    public void setSmooth(PluginCall call) {
        Boolean on = call.getBoolean("on", true);
        smooth = on == null || on;
        prefs().edit().putBoolean("smooth", smooth).apply();
        exec("window.__imeNative=" + (active && smooth));
        if (decorView != null) getActivity().runOnUiThread(() -> decorView.requestApplyInsets());
        call.resolve();
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences("lianchi_ui", Context.MODE_PRIVATE);
    }

    private void install(View decor) {
        final boolean passthrough = webViewMajor() >= WEBVIEW_VERSION_WITH_SAFE_AREA_FIX;
        ViewCompat.setOnApplyWindowInsetsListener(decor, (v, insets) -> {
            if (!smooth) return classic(v, insets, passthrough);
            if (!animating) send(imeHeight(insets), 0);
            WindowInsetsCompat noIme = new WindowInsetsCompat.Builder(insets)
                .setInsets(WindowInsetsCompat.Type.ime(), Insets.NONE)
                .setVisible(WindowInsetsCompat.Type.ime(), false)
                .build();
            int bars = WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout();
            Insets sb = noIme.getInsets(bars);
            WindowInsetsCompat out;
            if (passthrough) {
                // 和 SystemBars 一样：新版 WebView 自己处理安全区，系统栏的 insets 原样传下去
                v.setPadding(0, 0, 0, 0);
                out = noIme;
            } else {
                v.setPadding(sb.left, sb.top, sb.right, sb.bottom);
                out = new WindowInsetsCompat.Builder(noIme).setInsets(bars, Insets.of(0, 0, 0, 0)).build();
            }
            injectSafeArea(out.getInsets(bars));
            return out;
        });
        ViewCompat.setWindowInsetsAnimationCallback(
            decor,
            new WindowInsetsAnimationCompat.Callback(WindowInsetsAnimationCompat.Callback.DISPATCH_MODE_CONTINUE_ON_SUBTREE) {
                // 系统在动画开始前会先按最终状态派发一次 insets：这时就标记“动画中”，
                // 免得那一次没有时长的更新让页面先瞬间跳到终点（看起来像闪一下）
                @Override
                public void onPrepare(@NonNull WindowInsetsAnimationCompat animation) {
                    if (smooth && (animation.getTypeMask() & WindowInsetsCompat.Type.ime()) != 0) animating = true;
                }

                @NonNull
                @Override
                public WindowInsetsAnimationCompat.BoundsCompat onStart(
                    @NonNull WindowInsetsAnimationCompat animation,
                    @NonNull WindowInsetsAnimationCompat.BoundsCompat bounds
                ) {
                    if (smooth && (animation.getTypeMask() & WindowInsetsCompat.Type.ime()) != 0) {
                        animating = true;
                        // 动画开始时窗口已经是最终状态：拿最终的键盘高度
                        WindowInsetsCompat end = ViewCompat.getRootWindowInsets(decor);
                        send(end == null ? 0 : imeHeight(end), animation.getDurationMillis());
                    }
                    return bounds;
                }

                @NonNull
                @Override
                public WindowInsetsCompat onProgress(
                    @NonNull WindowInsetsCompat insets,
                    @NonNull List<WindowInsetsAnimationCompat> running
                ) {
                    return insets;
                }

                @Override
                public void onEnd(@NonNull WindowInsetsAnimationCompat animation) {
                    if ((animation.getTypeMask() & WindowInsetsCompat.Type.ime()) == 0) return;
                    animating = false;
                    if (!smooth) return;
                    WindowInsetsCompat end = ViewCompat.getRootWindowInsets(decor);
                    send(end == null ? 0 : imeHeight(end), 0);
                }
            }
        );
        active = true;
        decor.requestApplyInsets();
        exec("window.__imeNative=" + smooth);
    }

    /** 关掉动效时：和 Capacitor SystemBars 原来的做法一样，键盘出来时给窗口底部留出键盘高度（WebView 变小） */
    private WindowInsetsCompat classic(View v, WindowInsetsCompat insets, boolean passthrough) {
        send(0, 0);
        int bars = WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout();
        Insets sb = insets.getInsets(bars), ime = insets.getInsets(WindowInsetsCompat.Type.ime());
        boolean kb = insets.isVisible(WindowInsetsCompat.Type.ime());
        WindowInsetsCompat out;
        if (passthrough) {
            v.setPadding(0, 0, 0, kb ? ime.bottom : 0);
            int bottom = kb && webViewMajor() < 144 ? 0 : sb.bottom;
            out = new WindowInsetsCompat.Builder(insets).setInsets(bars, Insets.of(sb.left, sb.top, sb.right, bottom)).build();
            injectSafeArea(Insets.of(sb.left, sb.top, sb.right, kb ? 0 : sb.bottom));
        } else {
            v.setPadding(sb.left, sb.top, sb.right, kb ? ime.bottom : sb.bottom);
            out = new WindowInsetsCompat.Builder(insets).setInsets(bars, Insets.of(0, 0, 0, 0)).build();
            injectSafeArea(Insets.of(0, 0, 0, 0));
        }
        return out;
    }

    /** 键盘挡住的高度（扣掉导航栏，页面底部本来就给导航栏留了位置），CSS px */
    private int imeHeight(WindowInsetsCompat insets) {
        if (!insets.isVisible(WindowInsetsCompat.Type.ime())) return 0;
        int ime = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom;
        int nav = insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom;
        float density = getActivity().getResources().getDisplayMetrics().density;
        return Math.max(0, Math.round((ime - nav) / density));
    }

    private void send(int height, long durationMs) {
        if (height == lastSent && durationMs == 0) return;
        lastSent = height;
        exec(String.format(Locale.US, "window.__ime&&window.__ime(%d,%d)", height, durationMs));
    }

    private void injectSafeArea(Insets sb) {
        float density = getActivity().getResources().getDisplayMetrics().density;
        exec(
            String.format(
                Locale.US,
                "try{var s=document.documentElement.style;s.setProperty('--safe-area-inset-top','%dpx');s.setProperty('--safe-area-inset-right','%dpx');s.setProperty('--safe-area-inset-bottom','%dpx');s.setProperty('--safe-area-inset-left','%dpx')}catch(e){}",
                (int) (sb.top / density),
                (int) (sb.right / density),
                (int) (sb.bottom / density),
                (int) (sb.left / density)
            )
        );
    }

    private void exec(String js) {
        getBridge()
            .executeOnMainThread(() -> {
                if (getBridge() != null && getBridge().getWebView() != null) getBridge().getWebView().evaluateJavascript(js, null);
            });
    }

    private int webViewMajor() {
        try {
            PackageInfo info = WebViewCompat.getCurrentWebViewPackage(getContext());
            if (info != null && info.versionName != null) return Integer.parseInt(info.versionName.split("\\.")[0]);
        } catch (Exception e) {
            // 读不到版本就按旧版处理
        }
        return 0;
    }
}
