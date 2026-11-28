package `in`.ac.dypiu.campuscast.tv

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

class AutoLaunchService : Service() {

    private var screenReceiver: BroadcastReceiver? = null
    private var wakePoller: ScheduledExecutorService? = null

    companion object {
        const val CHANNEL_ID = "campuscast_kiosk_channel"
        const val NOTIF_ID = 1001

        fun start(context: Context) {
            val intent = Intent(context, AutoLaunchService::class.java)
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            } catch (_: Exception) {
            }
        }

        fun stop(context: Context) {
            try {
                context.stopService(Intent(context, AutoLaunchService::class.java))
            } catch (_: Exception) {
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        ensureChannel()
        val notif = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIF_ID,
                notif,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
            )
        } else {
            startForeground(NOTIF_ID, notif)
        }

        // Listen for TV waking up from Standby/Sleep so CampusCast comes right back to front
        screenReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent?) {
                val action = intent?.action ?: return
                if (action == Intent.ACTION_SCREEN_ON || action == Intent.ACTION_USER_PRESENT) {
                    val prefs = context.getSharedPreferences(MainActivity.PREFS_NAME, Context.MODE_PRIVATE)
                    val autoBoot = prefs.getBoolean(MainActivity.KEY_AUTO_BOOT, true)
                    val isConfigured = prefs.getBoolean(MainActivity.KEY_CONFIGURED, false)
                    if (autoBoot && isConfigured) {
                        launchPlayer(context)
                    }
                }
            }
        }
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_SCREEN_ON)
            addAction(Intent.ACTION_USER_PRESENT)
        }
        registerReceiver(screenReceiver, filter)

        // Poll server every 15s for remote Wake/Reconnect request from Dashboard Monitoring
        wakePoller = Executors.newSingleThreadScheduledExecutor().apply {
            scheduleWithFixedDelay({
                checkRemoteWakeSignal()
            }, 10, 15, TimeUnit.SECONDS)
        }
    }

    private fun checkRemoteWakeSignal() {
        try {
            val prefs = getSharedPreferences(MainActivity.PREFS_NAME, Context.MODE_PRIVATE)
            val autoBoot = prefs.getBoolean(MainActivity.KEY_AUTO_BOOT, true)
            val isConfigured = prefs.getBoolean(MainActivity.KEY_CONFIGURED, false)
            if (!autoBoot || !isConfigured) return

            val serverUrl = prefs.getString(MainActivity.KEY_SERVER_URL, MainActivity.DEFAULT_SERVER_URL) ?: return
            val screenId = prefs.getString(MainActivity.KEY_SCREEN_ID, MainActivity.DEFAULT_SCREEN_ID) ?: return

            if (serverUrl.isEmpty() || screenId.isEmpty()) return
            val base = MainActivity.apiBase(serverUrl) ?: return
            val deviceKey = prefs.getString(MainActivity.KEY_DEVICE_KEY, "") ?: ""
            val url = URL("$base/api/v1/device/${Uri.encode(screenId)}/wake-status")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                connectTimeout = 3000
                readTimeout = 3000
                if (deviceKey.isNotEmpty()) setRequestProperty("X-Device-Key", deviceKey)
            }
            val body = conn.inputStream.bufferedReader().use { it.readText() }
            conn.disconnect()

            val json = JSONObject(body)
            if (json.optBoolean("success", false) && json.optBoolean("wakeRequested", false)) {
                launchPlayer(this)
            }
        } catch (_: Exception) {
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    private fun launchPlayer(context: Context) {
        try {
            val launchIntent = Intent(context, MainActivity::class.java).apply {
                addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP or
                        Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
                )
            }
            context.startActivity(launchIntent)
        } catch (_: Exception) {
        }
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            val channel = NotificationChannel(
                CHANNEL_ID,
                "CampusCast TV Kiosk",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps CampusCast Digital Signage active after TV boot & wake"
            }
            manager?.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val openIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("CampusCast TV Signage Active")
            .setContentText("Auto-launch & remote wake enabled")
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentIntent(openIntent)
            .setOngoing(true)
            .build()
    }

    override fun onDestroy() {
        wakePoller?.shutdownNow()
        wakePoller = null
        screenReceiver?.let {
            try {
                unregisterReceiver(it)
            } catch (_: Exception) {
            }
        }
        screenReceiver = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
