package com.abigcyan.lianchi;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 本地插件：应用内更新时调起系统安装器
        registerPlugin(ApkInstallerPlugin.class);
        registerPlugin(AppChromePlugin.class);
        registerPlugin(LocalLlmPlugin.class);
        // 清脆可调的触感、键盘弹出时页面跟着平滑上移
        registerPlugin(FeelPlugin.class);
        registerPlugin(ImeAnimPlugin.class);
        // 助手在后台回答时保活
        registerPlugin(BusyPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
