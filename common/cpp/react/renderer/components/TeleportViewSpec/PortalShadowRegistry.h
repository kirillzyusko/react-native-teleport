#pragma once

#include <react/renderer/core/ReactPrimitives.h>
#include <react/renderer/core/ShadowNodeFamily.h>
#include <react/renderer/graphics/Point.h>

#include <atomic>
#include <memory>
#include <mutex>
#include <string>
#include <unordered_map>

namespace facebook::react {

  class ShadowTreeRevisionProvider;

  struct HostSize {
    float width;
    float height;
  };

  /*
   * Lets a portal `ShadowNode` read the committed shadow tree, so the position
   * of its host can be resolved at the moment of a measurement.
   * The provider is owned by `UIManager`.
   */
  struct PortalShadowTreeAccess {
    std::atomic<ShadowTreeRevisionProvider *> revisionProvider{nullptr};
    std::atomic<bool> isConnecting{false};
  };

  class PortalShadowRegistry {
   public:
    static PortalShadowRegistry &getInstance();

    void unregisterHost(const std::string &name);
    void updateHostSize(const std::string &name, HostSize size);
    HostSize getHostSize(const std::string &name) const;

    void registerHostFamily(Tag tag, const std::shared_ptr<const ShadowNodeFamily> &family);
    std::shared_ptr<const ShadowNodeFamily> getHostFamily(Tag tag) const;

    void updateViewportOffset(SurfaceId surfaceId, Point viewportOffset);
    Point getViewportOffset(SurfaceId surfaceId) const;

   private:
    PortalShadowRegistry() = default;
    mutable std::mutex mutex_;
    std::unordered_map<std::string, HostSize> hostSizes_;
    std::unordered_map<Tag, std::weak_ptr<const ShadowNodeFamily>> hostFamilies_;
    std::unordered_map<SurfaceId, Point> viewportOffsets_;
  };

} // namespace facebook::react
