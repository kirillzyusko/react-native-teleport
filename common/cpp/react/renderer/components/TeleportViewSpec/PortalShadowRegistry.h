#pragma once

#include <string>
#include <unordered_map>
#include <mutex>
#include <memory>

namespace facebook::react {

  struct HostSize {
    float width;
    float height;
  };

  class PortalShadowRegistry {
   public:
    static PortalShadowRegistry &getInstance();

    void unregisterHost(const std::string &name);
    void updateHostSize(const std::string &name, HostSize size);
    HostSize getHostSize(const std::string &name) const;

   private:
    PortalShadowRegistry() = default;
    mutable std::mutex mutex_;
    std::unordered_map<std::string, HostSize> hostSizes_;
  };

} // namespace facebook::react
