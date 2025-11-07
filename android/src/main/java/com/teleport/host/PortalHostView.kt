package com.teleport.host

import android.content.Context
import com.facebook.react.uimanager.PointerEvents
import com.facebook.react.views.view.ReactViewGroup
import com.teleport.global.PortalRegistry

class PortalHostView(
  context: Context?,
) : ReactViewGroup(context) {
  private var name: String? = null

  override var pointerEvents = PointerEvents.BOX_NONE

  fun setName(newName: String?) {
    if (name == newName) return

    name?.let { PortalRegistry.unregisterHost(it) }
    name = newName
    newName?.let { PortalRegistry.registerHost(it, this) }
  }

  // region Lifecycle
  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    name?.let { PortalRegistry.unregisterHost(it) }
  }
  // endregion
}
