package com.teleport.host

import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.PortalHostViewManagerInterface
import com.facebook.react.views.view.ReactViewGroup
import com.facebook.react.views.view.ReactViewManager

@ReactModule(name = PortalHostViewManager.NAME)
class PortalHostViewManager : ReactViewManager(),
  PortalHostViewManagerInterface<PortalHostView> {

  override fun getName(): String {
    return NAME
  }

  override fun createViewInstance(context: ThemedReactContext): ReactViewGroup {
    return PortalHostView(context)
  }

  @ReactProp(name = "name")
  override fun setName(view: PortalHostView?, name: String?) {
    view?.setName(name)
  }

  companion object {
    const val NAME = "PortalHostView"
  }
}
