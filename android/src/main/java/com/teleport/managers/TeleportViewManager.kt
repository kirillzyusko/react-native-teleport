package com.teleport.managers

import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.views.view.ReactViewGroup
import com.facebook.react.views.view.ReactViewManager

abstract class TeleportViewManager : ReactViewManager() {
  protected abstract fun createTeleportView(context: ThemedReactContext): ReactViewGroup

  fun forceBoxNone(view: ReactViewGroup) {
    super.setPointerEvents(view, "box-none")
  }

  override fun createViewInstance(context: ThemedReactContext): ReactViewGroup =
    createTeleportView(context).also {
      forceBoxNone(it)
    }

  override fun prepareToRecycleView(
    reactContext: ThemedReactContext,
    view: ReactViewGroup,
  ): ReactViewGroup? {
    super.prepareToRecycleView(reactContext, view)
    forceBoxNone(view)
    return view
  }
}
