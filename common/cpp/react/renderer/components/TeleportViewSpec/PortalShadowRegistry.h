#pragma once

#include <react/renderer/graphics/Geometry.h>

#include <string>
#include <unordered_map>
#include <mutex>
#include <memory>

namespace facebook::react {

  class PortalShadowRegistry {
   public:
    static PortalShadowRegistry &getInstance() {
      static PortalShadowRegistry instance;
      return instance;
    }

    void unregisterHost(const std::string &name);
    void updateHostSize(const std::string &name, Size size);
    Size getHostSize(const std::string &name) const;

   private:
    PortalShadowRegistry() = default;
    mutable std::mutex mutex_;
    std::unordered_map<std::string, Size> hostSizes_;
  };

} // namespace facebook::react
