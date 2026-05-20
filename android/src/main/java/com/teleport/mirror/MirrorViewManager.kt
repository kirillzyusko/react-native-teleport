package com.teleport.mirror

import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.MirrorViewManagerDelegate
import com.facebook.react.viewmanagers.MirrorViewManagerInterface
import com.facebook.react.views.view.ReactViewGroup
import com.teleport.managers.TeleportViewManager

@ReactModule(name = MirrorViewManager.NAME)
class MirrorViewManager :
  TeleportViewManager(),
  MirrorViewManagerInterface<ReactViewGroup> {
  private val delegate = MirrorViewManagerDelegate(this)

  override fun getName(): String = NAME

  override fun getDelegate(): ViewManagerDelegate<ReactViewGroup> = delegate

  override fun createTeleportView(context: ThemedReactContext): ReactViewGroup = MirrorView(context)

  override fun onDropViewInstance(view: ReactViewGroup) {
    super.onDropViewInstance(view)
    (view as? MirrorView)?.cleanup()
  }

  @ReactProp(name = "name")
  override fun setName(
    view: ReactViewGroup?,
    name: String?,
  ) {
    (view as? MirrorView)?.setName(name)
  }

  @ReactProp(name = "hidesSourceView", defaultBoolean = false)
  override fun setHidesSourceView(
    view: ReactViewGroup?,
    value: Boolean,
  ) {
    (view as? MirrorView)?.setHidesSourceView(value)
  }

  @ReactProp(name = "matchesAlpha", defaultBoolean = true)
  override fun setMatchesAlpha(
    view: ReactViewGroup?,
    value: Boolean,
  ) {
    (view as? MirrorView)?.setMatchesAlpha(value)
  }

  @ReactProp(name = "matchesTransform", defaultBoolean = false)
  override fun setMatchesTransform(
    view: ReactViewGroup?,
    value: Boolean,
  ) {
    (view as? MirrorView)?.setMatchesTransform(value)
  }

  @ReactProp(name = "matchesPosition", defaultBoolean = false)
  override fun setMatchesPosition(
    view: ReactViewGroup?,
    value: Boolean,
  ) {
    (view as? MirrorView)?.setMatchesPosition(value)
  }

  companion object {
    const val NAME = "MirrorView"
  }
}
