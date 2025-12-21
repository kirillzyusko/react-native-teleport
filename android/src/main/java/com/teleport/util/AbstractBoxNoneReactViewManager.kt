package com.teleport.util

import com.facebook.react.uimanager.PointerEvents
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.views.view.ReactViewGroup
import com.facebook.react.views.view.ReactViewManager

abstract class AbstractBoxNoneReactViewManager : ReactViewManager() {

  protected abstract fun createTeleportView(context: ThemedReactContext): ReactViewGroup

  final override fun createViewInstance(context: ThemedReactContext): ReactViewGroup {
    return createTeleportView(context).also {
      PointerEventsCompat.set(it, PointerEvents.BOX_NONE)
    }
  }

  final override fun onAfterUpdateTransaction(view: ReactViewGroup) {
    super.onAfterUpdateTransaction(view)
    PointerEventsCompat.set(view, PointerEvents.BOX_NONE)
  }
}
