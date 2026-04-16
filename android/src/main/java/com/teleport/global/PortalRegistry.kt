package com.teleport.global

import com.teleport.host.PortalHostView
import com.teleport.portal.PortalView
import java.lang.ref.WeakReference

interface MirrorViewCallback {
  fun onPortalAvailable()
}

object PortalRegistry {
  private val hosts: MutableMap<String, WeakReference<PortalHostView>> = HashMap()
  private val pendingPortals: MutableMap<String, MutableList<WeakReference<PortalView>>> = HashMap()
  private val portals: MutableMap<String, WeakReference<PortalView>> = HashMap()
  private val pendingMirrors: MutableMap<String, MutableList<WeakReference<MirrorViewCallback>>> = HashMap()

  fun registerHost(
    name: String,
    view: PortalHostView,
  ) {
    hosts[name] = WeakReference(view)

    pendingPortals[name]?.let { portals ->
      val iterator = portals.iterator()
      while (iterator.hasNext()) {
        val portalRef = iterator.next()
        portalRef.get()?.onHostAvailable() ?: iterator.remove()
      }
      pendingPortals.remove(name)
    }
  }

  fun unregisterHost(
    name: String,
    viewId: Int,
  ) {
    val hostViewId = hosts[name]?.get()?.id
    if (hostViewId == viewId) {
      hosts.remove(name)
    }
  }

  fun getHost(name: String?): PortalHostView? = hosts[name]?.get()

  fun registerPendingPortal(
    hostName: String,
    portal: PortalView,
  ) {
    val portals = pendingPortals.getOrPut(hostName) { mutableListOf() }
    portals.add(WeakReference(portal))
  }

  fun unregisterPendingPortal(
    hostName: String,
    portal: PortalView,
  ) {
    pendingPortals[hostName]?.let { portals ->
      portals.removeAll { it.get() == null || it.get() == portal }
      if (portals.isEmpty()) {
        pendingPortals.remove(hostName)
      }
    }
  }

  fun registerPortal(
    name: String,
    view: PortalView,
  ) {
    portals[name] = WeakReference(view)

    pendingMirrors[name]?.let { mirrors ->
      val iterator = mirrors.iterator()
      while (iterator.hasNext()) {
        val mirrorRef = iterator.next()
        mirrorRef.get()?.onPortalAvailable() ?: iterator.remove()
      }
      pendingMirrors.remove(name)
    }
  }

  fun unregisterPortal(
    name: String,
    viewId: Int,
  ) {
    val portalViewId = portals[name]?.get()?.id
    if (portalViewId == viewId) {
      portals.remove(name)
    }
  }

  fun getPortal(name: String?): PortalView? = portals[name]?.get()

  fun registerPendingMirror(
    portalName: String,
    mirror: MirrorViewCallback,
  ) {
    val mirrors = pendingMirrors.getOrPut(portalName) { mutableListOf() }
    mirrors.add(WeakReference(mirror))
  }

  fun unregisterPendingMirror(
    portalName: String,
    mirror: MirrorViewCallback,
  ) {
    pendingMirrors[portalName]?.let { mirrors ->
      mirrors.removeAll { it.get() == null || it.get() == mirror }
      if (mirrors.isEmpty()) {
        pendingMirrors.remove(portalName)
      }
    }
  }
}
