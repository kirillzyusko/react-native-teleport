#include "PortalShadowRegistry.h"

#include <string>

namespace facebook::react {

  void PortalShadowRegistry::unregisterHost(const std::string &name) {
    std::lock_guard<std::mutex> lock(mutex_);
    hostSizes_.erase(name);
  }

  void PortalShadowRegistry::updateHostSize(const std::string &name, Size size) {
    std::lock_guard<std::mutex> lock(mutex_);
    hostSizes_[name] = size;
  }

  Size PortalShadowRegistry::getHostSize(const std::string &name) const {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = hostSizes_.find(name);
    if (it != hostSizes_.end()) {
      return it->second;
    }
    return Size{0, 0};
  }

} // namespace facebook::react
