package com.teleport.portal

import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.PortalViewManagerInterface
import com.facebook.react.views.view.ReactViewGroup
import com.facebook.react.views.view.ReactViewManager

@ReactModule(name = PortalViewManager.NAME)
class PortalViewManager :
  ReactViewManager(),
  PortalViewManagerInterface<PortalView> {
  override fun getName(): String = NAME

  override fun createViewInstance(context: ThemedReactContext): ReactViewGroup = PortalView(context)

  @ReactProp(name = "name")
  override fun setName(
    view: PortalView?,
    name: String?,
  ) {
    // implement later if needed
  }

  @ReactProp(name = "hostName")
  override fun setHostName(
    view: PortalView?,
    name: String?,
  ) {
    view?.setHostName(name)
  }

  companion object {
    const val NAME = "PortalView"
  }
}
