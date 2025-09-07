package com.teleport.host

import android.content.Context
import com.facebook.react.views.view.ReactViewGroup
import com.teleport.global.PortalRegistry

class PortalHostView(
  context: Context?,
) : ReactViewGroup(context) {
  private var name: String? = null

  fun setName(newName: String?) {
    if (name == newName) return

    name?.let { PortalRegistry.unregister(it) }
    name = newName
    newName?.let { PortalRegistry.register(it, this) }
  }

  // region Lifecycle
  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    name?.let { PortalRegistry.unregister(it) }
  }
  // endregion
}
