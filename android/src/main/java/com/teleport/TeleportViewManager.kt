package com.teleport

import android.graphics.Color
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.TeleportViewManagerInterface
import com.facebook.react.viewmanagers.TeleportViewManagerDelegate

@ReactModule(name = TeleportViewManager.NAME)
class TeleportViewManager : SimpleViewManager<TeleportView>(),
  TeleportViewManagerInterface<TeleportView> {
  private val mDelegate: ViewManagerDelegate<TeleportView>

  init {
    mDelegate = TeleportViewManagerDelegate(this)
  }

  override fun getDelegate(): ViewManagerDelegate<TeleportView>? {
    return mDelegate
  }

  override fun getName(): String {
    return NAME
  }

  public override fun createViewInstance(context: ThemedReactContext): TeleportView {
    return TeleportView(context)
  }

  @ReactProp(name = "color")
  override fun setColor(view: TeleportView?, color: String?) {
    view?.setBackgroundColor(Color.parseColor(color))
  }

  companion object {
    const val NAME = "TeleportView"
  }
}
