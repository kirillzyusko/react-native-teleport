package teleport.example

import android.graphics.Rect
import android.os.SystemClock
import android.util.Log
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.HorizontalScrollView
import android.widget.OverScroller
import android.widget.ScrollView
import com.facebook.react.views.scroll.ReactScrollView
import java.lang.reflect.Field
import org.json.JSONArray
import org.json.JSONObject

/** Passive CI diagnostics: dispatch and event timestamps are never modified. */
internal object InputTrace {
  private const val TAG = "TeleportInputTrace"
  private val scrollFields: Map<String, Field?> by lazy {
    listOf("mScroller", "mDragging", "mActivelyScrolling", "mPostTouchRunnable", "mScrollEnabled")
        .associateWith { name ->
          try {
            ReactScrollView::class.java.getDeclaredField(name).apply { isAccessible = true }
          } catch (_: Exception) {
            null
          }
        }
  }

  fun installed() {
    Log.i(TAG, JSONObject()
        .put("phase", "installed")
        .put("traceVersion", 2)
        .put("dispatchUnchanged", true)
        .put("scrollStateFields", JSONArray(scrollFields.filterValues { it != null }.keys))
        .toString())
  }

  fun event(phase: String, event: MotionEvent, root: View, handled: Boolean? = null) {
    if (event.actionMasked == MotionEvent.ACTION_MOVE) return
    try {
      val now = SystemClock.uptimeMillis()
      val scrolls = JSONArray()
      describeScrolls(root, scrolls, event)
      val data = JSONObject()
          .put("phase", phase)
          .put("traceVersion", 2)
          .put("action", MotionEvent.actionToString(event.action))
          .put("x", event.x.toDouble())
          .put("y", event.y.toDouble())
          .put("rawX", event.rawX.toDouble())
          .put("rawY", event.rawY.toDouble())
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

  private fun describeScrolls(view: View, output: JSONArray, event: MotionEvent, depth: Int = 0) {
    if (depth > 32 || output.length() >= 8) return
    if (view is ScrollView || view is HorizontalScrollView) {
      val bounds = Rect()
      val visible = view.isShown && view.getGlobalVisibleRect(bounds)
      val data = JSONObject()
          .put("class", view.javaClass.simpleName)
          .put("x", view.scrollX)
          .put("y", view.scrollY)
          .put("pressed", view.isPressed)
          .put("visible", visible)
          .put("bounds", JSONArray(listOf(bounds.left, bounds.top, bounds.right, bounds.bottom)))
          .put("containsPoint", visible && bounds.contains(event.rawX.toInt(), event.rawY.toInt()))
      if (view is ReactScrollView) data.put("reactScrollState", reactScrollState(view))
      output.put(data)
    }
    if (view is ViewGroup) {
      for (index in 0 until view.childCount) {
        describeScrolls(view.getChildAt(index), output, event, depth + 1)
      }
    }
  }

  private fun reactScrollState(view: ReactScrollView): JSONObject {
    val data = JSONObject()
    try {
      val flags = listOf(
          "mDragging" to "dragging",
          "mActivelyScrolling" to "activelyScrolling",
          "mScrollEnabled" to "enabled")
      for ((field, key) in flags) {
        data.put(key, scrollFields[field]?.get(view) ?: JSONObject.NULL)
      }
      val postTouch = scrollFields["mPostTouchRunnable"]
      data.put("postTouchPending",
          if (postTouch == null) JSONObject.NULL else postTouch.get(view) != null)
      val scroller = scrollFields["mScroller"]?.get(view) as? OverScroller
      data.put("scrollerAvailable", scroller != null)
      if (scroller != null) {
        data.put("finished", scroller.isFinished)
            .put("currentY", scroller.currY)
            .put("finalY", scroller.finalY)
            .put("velocity", scroller.currVelocity.toDouble())
      }
      data.put("rnAnimationFinished", view.reactScrollViewScrollState.isFinished)
    } catch (error: Exception) {
      data.put("unavailable", error.javaClass.simpleName)
    }
    return data
  }
}
