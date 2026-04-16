package com.teleport.mirror

import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.MirrorViewManagerDelegate
import com.facebook.react.viewmanagers.MirrorViewManagerInterface
import com.facebook.react.views.view.ReactViewGroup
import com.facebook.react.views.view.ReactViewManager

@ReactModule(name = MirrorViewManager.NAME)
class MirrorViewManager :
  ReactViewManager(),
  MirrorViewManagerInterface<ReactViewGroup> {
  private val delegate = MirrorViewManagerDelegate(this)

  override fun getName(): String = NAME

  override fun getDelegate(): ViewManagerDelegate<ReactViewGroup> = delegate

  override fun createViewInstance(context: ThemedReactContext): ReactViewGroup = MirrorView(context)

  override fun onDropViewInstance(view: ReactViewGroup) {
    super.onDropViewInstance(view)
    (view as? MirrorView)?.cleanup()
  }

  @ReactProp(name = "name")
  override fun setName(
    view: ReactViewGroup?,
    name: String?,
  ) {
    (view as? MirrorView)?.setPortalName(name)
  }

  @ReactProp(name = "mode")
  override fun setMode(
    view: ReactViewGroup?,
    mode: String?,
  ) {
    (view as? MirrorView)?.setMode(mode)
  }

  companion object {
    const val NAME = "MirrorView"
  }
}
