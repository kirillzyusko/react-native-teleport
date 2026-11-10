package com.teleport.host

import android.view.View
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.PortalHostViewManagerDelegate
import com.facebook.react.viewmanagers.PortalHostViewManagerInterface
import com.facebook.react.views.view.ReactViewGroup
import com.teleport.managers.TeleportViewManager

@ReactModule(name = PortalHostViewManager.NAME)
class PortalHostViewManager :
  TeleportViewManager(),
  PortalHostViewManagerInterface<ReactViewGroup> {
  private val delegate = PortalHostViewManagerDelegate(this)

  override fun getName(): String = NAME

  override fun getDelegate(): ViewManagerDelegate<ReactViewGroup> = delegate

  override fun createTeleportView(context: ThemedReactContext): ReactViewGroup = PortalHostView(context)

  override fun addView(
    parent: ReactViewGroup,
    child: View,
    index: Int,
  ) {
    (parent as PortalHostView).portalContainer.addView(child, index)
  }

  override fun getChildCount(parent: ReactViewGroup): Int = (parent as PortalHostView).portalContainer.childCount

  override fun getChildAt(
    parent: ReactViewGroup,
    index: Int,
  ): View? = (parent as PortalHostView).portalContainer.getChildAt(index)

  override fun removeViewAt(
    parent: ReactViewGroup,
    index: Int,
  ) {
    (parent as PortalHostView).portalContainer.removeViewAt(index)
  }

  override fun removeAllViews(parent: ReactViewGroup) {
    (parent as PortalHostView).portalContainer.removeAllViews()
  }

  override fun onAfterUpdateTransaction(view: ReactViewGroup) {
    super.onAfterUpdateTransaction(view)
    if ((view as? PortalHostView)?.fullScreen == true) forceNone(view) else forceBoxNone(view)
  }

  override fun onDropViewInstance(view: ReactViewGroup) {
    super.onDropViewInstance(view)

    (view as? PortalHostView)?.cleanup(view.id)
  }

  @ReactProp(name = "name")
  override fun setName(
    view: ReactViewGroup?,
    name: String?,
  ) {
    (view as? PortalHostView)?.setName(name)
  }

  @ReactProp(name = "fullScreen", defaultBoolean = false)
  override fun setFullScreen(
    view: ReactViewGroup?,
    fullScreen: Boolean,
  ) {
    (view as? PortalHostView)?.fullScreen = fullScreen
  }

  companion object {
    const val NAME = "PortalHostView"
  }
}
