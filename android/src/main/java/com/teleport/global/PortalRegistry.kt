package com.teleport.global

import com.teleport.host.PortalHostView
import com.teleport.mirror.MirrorView
import com.teleport.portal.PortalView
import java.lang.ref.WeakReference

object PortalRegistry {
  private val hosts: MutableMap<String, WeakReference<PortalHostView>> = HashMap()
  private val pendingPortals: MutableMap<String, MutableList<WeakReference<PortalView>>> = HashMap()
  private val portalSources: MutableMap<String, WeakReference<android.view.View>> = HashMap()
  private val pendingMirrors: MutableMap<String, MutableList<WeakReference<MirrorView>>> = HashMap()

  fun registerHost(
    name: String,
    view: PortalHostView,
  ) {
    hosts[name] = WeakReference(view)
    notifySubscribers(name)
  }

  fun unregisterHost(
    name: String,
    viewId: Int,
  ) {
    val hostViewId = hosts[name]?.get()?.id
    if (hostViewId == viewId) {
      hosts.remove(name)
      notifySubscribers(name)
    }
  }

  private fun notifySubscribers(name: String) {
    pendingPortals[name]?.let { portals ->
      val iterator = portals.iterator()
      while (iterator.hasNext()) {
        val portalRef = iterator.next()
        portalRef.get()?.onHostChanged() ?: iterator.remove()
      }
    }
  }

  fun notifyHostLayoutChanged(name: String) {
    pendingPortals[name]?.let { portals ->
      val iterator = portals.iterator()
      while (iterator.hasNext()) {
        val portalRef = iterator.next()
        portalRef.get()?.onHostLayoutChanged() ?: iterator.remove()
      }
    }
  }

  private fun notifyMirrors(name: String) {
    pendingMirrors[name]?.let { mirrors ->
      val iterator = mirrors.iterator()
      while (iterator.hasNext()) {
        val mirrorRef = iterator.next()
        mirrorRef.get()?.onSourceChanged() ?: iterator.remove()
      }
    }
  }

  fun getHost(name: String?): PortalHostView? = hosts[name]?.get()

  fun registerPortalSource(
    name: String,
    source: android.view.View,
  ) {
    portalSources[name] = WeakReference(source)
    notifyMirrors(name)
  }

  fun unregisterPortalSource(
    name: String,
    source: android.view.View,
  ) {
    val registered = portalSources[name]?.get()
    if (registered == null || registered == source) {
      portalSources.remove(name)
      notifyMirrors(name)
    }
  }

  fun getPortalSource(name: String?): android.view.View? = portalSources[name]?.get()

  fun registerPendingPortal(
    hostName: String,
    portal: PortalView,
  ) {
    val portals = pendingPortals.getOrPut(hostName) { mutableListOf() }
    portals.removeAll { it.get() == null || it.get() == portal }
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

  fun registerPendingMirror(
    name: String,
    mirror: MirrorView,
  ) {
    val mirrors = pendingMirrors.getOrPut(name) { mutableListOf() }
    mirrors.add(WeakReference(mirror))
  }

  fun unregisterPendingMirror(
    name: String,
    mirror: MirrorView,
  ) {
    pendingMirrors[name]?.let { mirrors ->
      mirrors.removeAll { it.get() == null || it.get() == mirror }
      if (mirrors.isEmpty()) {
        pendingMirrors.remove(name)
      }
    }
  }
}
