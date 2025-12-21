package com.teleport.host

import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.PortalHostViewManagerDelegate
import com.facebook.react.viewmanagers.PortalHostViewManagerInterface
import com.facebook.react.views.view.ReactViewGroup
import com.facebook.react.views.view.ReactViewManager
import com.facebook.react.uimanager.PointerEvents
import com.teleport.util.AbstractBoxNoneReactViewManager

@ReactModule(name = PortalHostViewManager.NAME)
class PortalHostViewManager :
  AbstractBoxNoneReactViewManager(),
  PortalHostViewManagerInterface<ReactViewGroup> {
  private val delegate = PortalHostViewManagerDelegate(this)

  override fun getName(): String = NAME

  override fun getDelegate(): ViewManagerDelegate<ReactViewGroup> = delegate

  override fun createTeleportView(context: ThemedReactContext): ReactViewGroup =
      PortalHostView(context)

  @ReactProp(name = "name")
  override fun setName(
    view: ReactViewGroup?,
    name: String?,
  ) {
    (view as? PortalHostView)?.setName(name)
  }

  companion object {
    const val NAME = "PortalHostView"
  }
}
