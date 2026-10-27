package teleport.example

import android.os.SystemClock
import android.util.Log
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.HorizontalScrollView
import android.widget.ScrollView
import org.json.JSONArray
import org.json.JSONObject

/** Passive CI diagnostics: dispatch and event timestamps are never modified. */
internal object InputTrace {
  private const val TAG = "TeleportInputTrace"

  fun installed() {
    Log.i(TAG, "{\"phase\":\"installed\",\"dispatchUnchanged\":true}")
  }

  fun event(phase: String, event: MotionEvent, root: View, handled: Boolean? = null) {
    if (event.actionMasked == MotionEvent.ACTION_MOVE) return
    try {
      val now = SystemClock.uptimeMillis()
      val scrolls = JSONArray()
      describeScrolls(root, scrolls)
      val data = JSONObject()
          .put("phase", phase)
          .put("action", MotionEvent.actionToString(event.action))
          .put("x", event.x.toDouble())
          .put("y", event.y.toDouble())
          .put("downTime", event.downTime)
          .put("eventTime", event.eventTime)
          .put("receivedUptime", now)
          .put("queuedMs", now - event.eventTime)
          .put("source", event.source)
          .put("deviceId", event.deviceId)
          .put("flags", event.flags)
          .put("scrolls", scrolls)
      if (handled != null) data.put("handled", handled)
      Log.i(TAG, data.toString())
    } catch (error: Exception) {
      // A diagnostic failure must not prevent the original event from dispatching.
      Log.w(TAG, "trace.error", error)
    }
  }

  private fun describeScrolls(view: View, output: JSONArray, depth: Int = 0) {
    if (depth > 32 || output.length() >= 8) return
    if (view is ScrollView || view is HorizontalScrollView) {
      output.put(JSONObject()
          .put("class", view.javaClass.simpleName)
          .put("x", view.scrollX)
          .put("y", view.scrollY)
          .put("pressed", view.isPressed))
    }
    if (view is ViewGroup) {
      for (index in 0 until view.childCount) {
        describeScrolls(view.getChildAt(index), output, depth + 1)
      }
    }
  }
}
