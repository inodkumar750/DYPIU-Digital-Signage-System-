package `in`.ac.dypiu.campuscast.tv

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.ConnectivityManager
import android.net.Network
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.view.inputmethod.InputMethodManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var setupOverlay: ScrollView
    private lateinit var errorOverlay: LinearLayout
    private lateinit var errorText: TextView
    private lateinit var etServerUrl: EditText
    private lateinit var etScreenId: EditText
    private lateinit var cbAutoBoot: CheckBox
    private lateinit var tvAutoBootStatus: TextView

    private val handler = Handler(Looper.getMainLooper())
    private val otaExecutor = Executors.newSingleThreadExecutor()
    private var backPressCount = 0
    private var lastBackPressTime = 0L
    private var currentLoadedUrl: String = ""
    private var lastBaseServerUrl: String = ""
    private var hasLoadError = false
    private var otaInProgress = false
    private var networkCallback: ConnectivityManager.NetworkCallback? = null

    private val otaPeriodicRunnable = object : Runnable {
        override fun run() {
            if (lastBaseServerUrl.isNotEmpty()) {
                checkForOtaUpdate(lastBaseServerUrl)
            }
            handler.postDelayed(this, 30 * 60 * 1000L)
        }
    }

    private val retryRunnable = Runnable {
        if (currentLoadedUrl.isNotEmpty() && setupOverlay.visibility != View.VISIBLE) {
            hasLoadError = false
            webView.loadUrl(currentLoadedUrl)
        }
    }

    companion object {
        const val PREFS_NAME = "campuscast_tv_prefs"
        const val KEY_SERVER_URL = "server_url"
        const val KEY_SCREEN_ID = "screen_id"
        const val KEY_AUTO_BOOT = "auto_boot"
        const val KEY_CONFIGURED = "is_configured"
        const val DEFAULT_SERVER_URL = "http://10.40.0.193:3000"
        const val DEFAULT_SCREEN_ID = "DYPIU-TV-012"
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setContentView(R.layout.activity_main)
        enableFullscreen()

        webView = findViewById(R.id.webView)
        setupOverlay = findViewById(R.id.setupOverlay)
        errorOverlay = findViewById(R.id.errorOverlay)
        errorText = findViewById(R.id.errorText)
        etServerUrl = findViewById(R.id.etServerUrl)
        etScreenId = findViewById(R.id.etScreenId)
        cbAutoBoot = findViewById(R.id.cbAutoBoot)
        tvAutoBootStatus = findViewById(R.id.tvAutoBootStatus)

        val btnPresetSansui: Button = findViewById(R.id.btnPresetSansui)
        val btnPresetLobby: Button = findViewById(R.id.btnPresetLobby)
        val btnPresetStendy: Button = findViewById(R.id.btnPresetStendy)
        val btnOverlayPermission: Button = findViewById(R.id.btnOverlayPermission)
        val btnTvHomeLauncher: Button = findViewById(R.id.btnTvHomeLauncher)
        val btnLaunch: Button = findViewById(R.id.btnLaunch)
        val btnRetry: Button = findViewById(R.id.btnRetry)
        val btnOpenSetupFromError: Button = findViewById(R.id.btnOpenSetupFromError)

        configureWebView()
        registerNetworkReconnect()

        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val savedServer = prefs.getString(KEY_SERVER_URL, DEFAULT_SERVER_URL) ?: DEFAULT_SERVER_URL
        val savedScreen = prefs.getString(KEY_SCREEN_ID, DEFAULT_SCREEN_ID) ?: DEFAULT_SCREEN_ID
        val autoBoot = prefs.getBoolean(KEY_AUTO_BOOT, true)
        val isConfigured = prefs.getBoolean(KEY_CONFIGURED, false)

        etServerUrl.setText(savedServer)
        etScreenId.setText(savedScreen)
        cbAutoBoot.isChecked = autoBoot
        updateAutoBootStatusLabel()

        btnPresetSansui.setOnClickListener {
            etScreenId.setText("DYPIU-TV-012")
        }

        btnPresetLobby.setOnClickListener {
            etScreenId.setText("DYPIU-TV-001")
        }

        btnPresetStendy.setOnClickListener {
            etScreenId.setText("DYPIU-STENDY")
        }

        btnOverlayPermission.setOnClickListener {
            openOverlayPermissionSettings()
        }

        btnTvHomeLauncher.setOnClickListener {
            openTvHomeSettings()
        }

        btnLaunch.setOnClickListener {
            val server = etServerUrl.text.toString().trim().trimEnd('/')
                .ifEmpty { DEFAULT_SERVER_URL }
            val screenId = etScreenId.text.toString().trim()
                .ifEmpty { DEFAULT_SCREEN_ID }

            prefs.edit()
                .putString(KEY_SERVER_URL, server)
                .putString(KEY_SCREEN_ID, screenId)
                .putBoolean(KEY_AUTO_BOOT, cbAutoBoot.isChecked)
                .putBoolean(KEY_CONFIGURED, true)
                .apply()

            if (cbAutoBoot.isChecked) {
                AutoLaunchService.start(this)
            } else {
                AutoLaunchService.stop(this)
            }

            try {
                val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
                imm?.hideSoftInputFromWindow(etScreenId.windowToken, 0)
            } catch (_: Exception) {
            }

            setupOverlay.visibility = View.GONE
            loadKioskPlayer(server, screenId)
        }

        btnRetry.setOnClickListener {
            handler.removeCallbacks(retryRunnable)
            errorOverlay.visibility = View.GONE
            if (currentLoadedUrl.isNotEmpty()) {
                hasLoadError = false
                webView.loadUrl(currentLoadedUrl)
            }
        }

        btnOpenSetupFromError.setOnClickListener {
            handler.removeCallbacks(retryRunnable)
            errorOverlay.visibility = View.GONE
            openSetupOverlay()
        }

        if (isConfigured) {
            if (autoBoot) {
                AutoLaunchService.start(this)
            }
            loadKioskPlayer(savedServer, savedScreen)
        } else {
            openSetupOverlay()
        }
    }

    override fun onResume() {
        super.onResume()
        updateAutoBootStatusLabel()
    }

    private fun updateAutoBootStatusLabel() {
        val overlayGranted = Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(this)
        tvAutoBootStatus.text = if (overlayGranted) {
            "Auto-Start Overlay Permission: GRANTED (TV will auto-open after power ON)"
        } else {
            "Auto-Start Permission: Tap 'Allow Boot Auto-Open' OR 'Set Default TV Home' for zero-touch boot"
        }
    }

    private fun openOverlayPermissionSettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                startActivity(
                    Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:$packageName")
                    )
                )
                return
            } catch (_: Exception) {
            }
        }
        try {
            startActivity(
                Intent(
                    Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.parse("package:$packageName")
                )
            )
        } catch (_: Exception) {
            try {
                startActivity(Intent(Settings.ACTION_SETTINGS))
            } catch (_: Exception) {
            }
        }
    }

    private fun openTvHomeSettings() {
        val candidates = listOf(
            Intent(Settings.ACTION_HOME_SETTINGS),
            Intent(Settings.ACTION_SETTINGS)
        )
        for (intent in candidates) {
            try {
                startActivity(intent)
                return
            } catch (_: Exception) {
            }
        }
    }

    private fun registerNetworkReconnect() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            try {
                val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return
                val cb = object : ConnectivityManager.NetworkCallback() {
                    override fun onAvailable(network: Network) {
                        handler.post {
                            if (hasLoadError && currentLoadedUrl.isNotEmpty() && setupOverlay.visibility != View.VISIBLE) {
                                hasLoadError = false
                                errorOverlay.visibility = View.GONE
                                webView.loadUrl(currentLoadedUrl)
                            }
                        }
                    }
                }
                cm.registerDefaultNetworkCallback(cb)
                networkCallback = cb
            } catch (_: Exception) {
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        webView.setInitialScale(0)
        webView.clearCache(true)

        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.useWideViewPort = false
        settings.loadWithOverviewMode = false
        settings.setSupportZoom(false)
        settings.builtInZoomControls = false
        settings.displayZoomControls = false
        settings.textZoom = 100
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

        webView.webChromeClient = object : WebChromeClient() {
            override fun getDefaultVideoPoster(): Bitmap {
                return Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888)
            }
        }
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                if (!hasLoadError) {
                    errorOverlay.visibility = View.GONE
                    handler.removeCallbacks(retryRunnable)
                }
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                    hasLoadError = true
                    showConnectionError("Cannot reach $currentLoadedUrl — retrying in 5s...")
                }
            }
        }
    }

    private fun loadKioskPlayer(serverBaseUrl: String, screenId: String) {
        val normalized = if (serverBaseUrl.startsWith("http://") || serverBaseUrl.startsWith("https://")) {
            serverBaseUrl
        } else {
            "http://$serverBaseUrl"
        }
        lastBaseServerUrl = normalized
        val uri = Uri.parse(normalized).buildUpon()
            .appendQueryParameter("tv", screenId)
            .appendQueryParameter("kiosk", "1")
            .build()
        currentLoadedUrl = uri.toString()
        hasLoadError = false
        errorOverlay.visibility = View.GONE
        webView.loadUrl(currentLoadedUrl)

        handler.removeCallbacks(otaPeriodicRunnable)
        handler.postDelayed(otaPeriodicRunnable, 5000L)
    }

    private fun getInstalledVersionCode(): Long {
        return try {
            val pInfo = packageManager.getPackageInfo(packageName, 0)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                pInfo.longVersionCode
            } else {
                @Suppress("DEPRECATION")
                pInfo.versionCode.toLong()
            }
        } catch (_: Exception) {
            1L
        }
    }

    private fun checkForOtaUpdate(serverBaseUrl: String) {
        if (otaInProgress) return
        otaInProgress = true
        otaExecutor.execute {
            try {
                val parsed = Uri.parse(serverBaseUrl)
                val host = parsed.host ?: return@execute
                val scheme = parsed.scheme ?: "http"
                val versionUrl = URL("$scheme://$host:5000/api/v1/device/app-version")
                val conn = (versionUrl.openConnection() as HttpURLConnection).apply {
                    connectTimeout = 5000
                    readTimeout = 5000
                }
                val body = conn.inputStream.bufferedReader().use { it.readText() }
                conn.disconnect()

                val json = JSONObject(body)
                if (!json.optBoolean("success", false)) return@execute
                val remoteCode = json.optLong("versionCode", 0L)
                val apkUrlStr = json.optString("apkUrl", "")
                if (remoteCode <= getInstalledVersionCode() || apkUrlStr.isEmpty()) {
                    return@execute
                }

                // Download updated APK directly over Wi-Fi into cache
                val apkFile = File(cacheDir, "CampusCast-TV-update.apk")
                val dlConn = (URL(apkUrlStr).openConnection() as HttpURLConnection).apply {
                    connectTimeout = 10000
                    readTimeout = 30000
                }
                dlConn.inputStream.use { input ->
                    FileOutputStream(apkFile).use { output ->
                        input.copyTo(output)
                    }
                }
                dlConn.disconnect()

                handler.post {
                    try {
                        val contentUri = FileProvider.getUriForFile(
                            this,
                            "$packageName.fileprovider",
                            apkFile
                        )
                        val installIntent = Intent(Intent.ACTION_VIEW).apply {
                            setDataAndType(contentUri, "application/vnd.android.package-archive")
                            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                        startActivity(installIntent)
                    } catch (_: Exception) {
                    }
                }
            } catch (_: Exception) {
            } finally {
                otaInProgress = false
            }
        }
    }

    private fun showConnectionError(message: String) {
        if (setupOverlay.visibility == View.VISIBLE) return
        errorText.text = message
        errorOverlay.visibility = View.VISIBLE
        handler.removeCallbacks(retryRunnable)
        handler.postDelayed(retryRunnable, 5000)
    }

    private fun openSetupOverlay() {
        handler.removeCallbacks(retryRunnable)
        setupOverlay.visibility = View.VISIBLE
        findViewById<Button>(R.id.btnLaunch).requestFocus()
    }

    private fun enableFullscreen() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.hide(WindowInsetsCompat.Type.systemBars())
        controller.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            enableFullscreen()
        }
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_MENU || keyCode == KeyEvent.KEYCODE_INFO) {
            if (setupOverlay.visibility == View.VISIBLE) {
                setupOverlay.visibility = View.GONE
            } else {
                openSetupOverlay()
            }
            return true
        }

        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (setupOverlay.visibility == View.VISIBLE) {
                setupOverlay.visibility = View.GONE
                return true
            }
            val now = System.currentTimeMillis()
            if (now - lastBackPressTime < 1500) {
                backPressCount += 1
            } else {
                backPressCount = 1
            }
            lastBackPressTime = now
            if (backPressCount >= 3) {
                backPressCount = 0
                openSetupOverlay()
            }
            return true
        }

        return super.onKeyDown(keyCode, event)
    }

    override fun onDestroy() {
        handler.removeCallbacks(retryRunnable)
        handler.removeCallbacks(otaPeriodicRunnable)
        otaExecutor.shutdownNow()
        networkCallback?.let {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                try {
                    val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
                    cm?.unregisterNetworkCallback(it)
                } catch (_: Exception) {
                }
            }
        }
        webView.destroy()
        super.onDestroy()
    }
}
