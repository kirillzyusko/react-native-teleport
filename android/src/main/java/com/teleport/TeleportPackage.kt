package com.teleport

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import com.teleport.host.PortalHostViewManager
import com.teleport.mirror.MirrorViewManager
import com.teleport.portal.PortalViewManager
import java.util.ArrayList

class TeleportPackage : ReactPackage {
  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    val viewManagers: MutableList<ViewManager<*, *>> = ArrayList()
    viewManagers.add(PortalHostViewManager())
    viewManagers.add(PortalViewManager())
    viewManagers.add(MirrorViewManager())
    return viewManagers
  }

  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> = emptyList()
}
