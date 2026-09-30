package com.abigcyan.lianchi;

import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.view.Window;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 系统栏后面的窗口底色。
 * 旧版系统 WebView（Chromium 140 以前）不能画到状态栏、导航栏下面，Capacitor 会给页面留出这两块，
 * 露出来的是窗口背景（默认白色）。这里把窗口背景涂成页面当前的底色（跟深浅色、背景色调、卡片风格走）。
 */
@CapacitorPlugin(name = "AppChrome")
public class AppChromePlugin extends Plugin {

    @PluginMethod
    public void setBackground(PluginCall call) {
        final String c = call.getString("color", "");
        final int color;
        try {
            color = Color.parseColor(c);
        } catch (IllegalArgumentException e) {
            call.reject("颜色格式不对：" + c);
            return;
        }
        getActivity().runOnUiThread(() -> {
            Window w = getActivity().getWindow();
            w.setBackgroundDrawable(new ColorDrawable(color));
            w.getDecorView().setBackgroundColor(color);
            call.resolve();
        });
    }
}
