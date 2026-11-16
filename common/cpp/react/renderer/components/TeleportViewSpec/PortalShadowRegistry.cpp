#include "PortalShadowRegistry.h"

#include <memory>
#include <string>

namespace facebook::react {

  PortalShadowRegistry &PortalShadowRegistry::getInstance() {
    static PortalShadowRegistry instance;
    return instance;
  }

  void PortalShadowRegistry::unregisterHost(const std::string &name) {
    std::lock_guard<std::mutex> lock(mutex_);
    hostSizes_.erase(name);
  }

  void PortalShadowRegistry::updateHostSize(const std::string &name, HostSize size) {
    std::lock_guard<std::mutex> lock(mutex_);
    hostSizes_[name] = size;
  }

  HostSize PortalShadowRegistry::getHostSize(const std::string &name) const {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = hostSizes_.find(name);
    if (it != hostSizes_.end()) {
      return it->second;
    }
    return HostSize{0, 0};
  }

  void PortalShadowRegistry::registerHostFamily(
      Tag tag,
      const std::shared_ptr<const ShadowNodeFamily> &family) {
    std::lock_guard<std::mutex> lock(mutex_);
    // use the occasion to forget the hosts that are gone
    for (auto entry = hostFamilies_.begin(); entry != hostFamilies_.end();) {
      entry = entry->second.expired() ? hostFamilies_.erase(entry) : std::next(entry);
    }
    hostFamilies_[tag] = family;
  }

  std::shared_ptr<const ShadowNodeFamily> PortalShadowRegistry::getHostFamily(Tag tag) const {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = hostFamilies_.find(tag);
    if (it != hostFamilies_.end()) {
      return it->second.lock();
    }
    return nullptr;
  }

  void PortalShadowRegistry::updateViewportOffset(SurfaceId surfaceId, Point viewportOffset) {
    std::lock_guard<std::mutex> lock(mutex_);
    viewportOffsets_[surfaceId] = viewportOffset;
  }

  Point PortalShadowRegistry::getViewportOffset(SurfaceId surfaceId) const {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = viewportOffsets_.find(surfaceId);
    if (it != viewportOffsets_.end()) {
      return it->second;
    }
    return Point{};
  }

} // namespace facebook::react
