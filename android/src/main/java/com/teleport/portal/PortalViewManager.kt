package com.teleport.portal

import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.PortalViewManagerDelegate
import com.facebook.react.viewmanagers.PortalViewManagerInterface
import com.facebook.react.views.view.ReactViewGroup
import com.facebook.react.views.view.ReactViewManager
import com.teleport.util.TeleportViewManager

@ReactModule(name = PortalViewManager.NAME)
class PortalViewManager :
  TeleportViewManager(),
  PortalViewManagerInterface<ReactViewGroup> {
  private val delegate = PortalViewManagerDelegate(this)

  override fun getName(): String = NAME

  override fun getDelegate(): ViewManagerDelegate<ReactViewGroup> = delegate

  override fun createTeleportView(context: ThemedReactContext): ReactViewGroup = PortalView(context)

  @ReactProp(name = "name")
  override fun setName(
    view: ReactViewGroup?,
    name: String?,
  ) {
    // implement later if needed
  }

  @ReactProp(name = "hostName")
  override fun setHostName(
    view: ReactViewGroup?,
    name: String?,
  ) {
    (view as? PortalView)?.setHostName(name)
  }

  companion object {
    const val NAME = "PortalView"
  }
}
