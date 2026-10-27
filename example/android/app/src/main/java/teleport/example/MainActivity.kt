package teleport.example

import android.os.Bundle
import android.view.MotionEvent
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "TeleportExample"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      object : DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled) {
        override fun getLaunchOptions(): Bundle = Bundle().apply {
          putBoolean("teleportInputTrace", BuildConfig.TELEPORT_INPUT_TRACE)
          if (BuildConfig.TELEPORT_INPUT_TRACE) InputTrace.installed()
        }
      }

  override fun dispatchTouchEvent(event: MotionEvent): Boolean {
    if (!BuildConfig.TELEPORT_INPUT_TRACE) return super.dispatchTouchEvent(event)
    InputTrace.event("received", event, window.decorView)
    val handled = super.dispatchTouchEvent(event)
    InputTrace.event("returned", event, window.decorView, handled)
    return handled
  }
}
