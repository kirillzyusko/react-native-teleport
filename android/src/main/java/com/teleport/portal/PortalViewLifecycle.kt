package com.teleport.portal

import com.facebook.react.uimanager.StateWrapper

/** Lifecycle operations invoked by [PortalViewManager] on its managed native view. */
interface PortalViewLifecycle {
  fun setStateWrapper(wrapper: StateWrapper?)

  fun setHostName(name: String?)

  fun cleanup()
}
