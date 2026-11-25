#pragma once

#include <react/renderer/core/ReactPrimitives.h>
#include <react/renderer/core/ShadowNodeFamily.h>

#include <memory>
#include <mutex>
#include <string>
#include <unordered_map>

namespace facebook::react {

  struct HostSize {
    float width;
    float height;
    // the host that has this size
    Tag tag{0};
  };

  class PortalShadowRegistry {
   public:
    static PortalShadowRegistry &getInstance();

    void unregisterHost(const std::string &name);
    void updateHostSize(const std::string &name, HostSize size);
    HostSize getHostSize(const std::string &name) const;

    void registerHostFamily(Tag tag, const std::shared_ptr<const ShadowNodeFamily> &family);
    std::shared_ptr<const ShadowNodeFamily> getHostFamily(Tag tag) const;

   private:
    PortalShadowRegistry() = default;
    mutable std::mutex mutex_;
    std::unordered_map<std::string, HostSize> hostSizes_;
    std::unordered_map<Tag, std::weak_ptr<const ShadowNodeFamily>> hostFamilies_;
  };

} // namespace facebook::react
