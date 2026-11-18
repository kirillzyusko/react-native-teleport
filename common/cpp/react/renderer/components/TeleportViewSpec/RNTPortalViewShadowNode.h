#pragma once

#include "RNTPortalViewState.h"
#include "PortalShadowRegistry.h"

#include <react/renderer/components/TeleportViewSpec/EventEmitters.h>
#include <react/renderer/components/TeleportViewSpec/Props.h>
#include <react/renderer/components/root/RootShadowNode.h>
#include <react/renderer/components/view/ConcreteViewShadowNode.h>
#include <react/renderer/graphics/Transform.h>
#include <react/renderer/uimanager/consistency/ShadowTreeRevisionProvider.h>
#include <jsi/jsi.h>

#include <atomic>
#include <memory>
#include <utility>

namespace facebook::react {

  JSI_EXPORT extern const char PortalViewComponentName[];

  /*
   * Lets a portal `ShadowNode` read the committed shadow tree, so the position
   * of its host can be resolved at the moment of a measurement.
   * The provider is owned by `UIManager`.
   */
  struct PortalShadowTreeAccess {
    std::atomic<ShadowTreeRevisionProvider *> revisionProvider{nullptr};
    std::atomic<bool> isConnecting{false};
  };

  /*
   * `ShadowNode` for <PortalView> component.
   */
  class PortalViewShadowNode : public ConcreteViewShadowNode<
                                   PortalViewComponentName,
                                   PortalViewProps,
                                   PortalViewEventEmitter,
                                   PortalViewState> {
   public:
    using ConcreteViewShadowNode::ConcreteViewShadowNode;

    // Helper method to conditionally set dimensions from host
    void setDimensionsFromHost(HostSize hostSize) const {
      // printf("HostSize:: width - %f height - %f\n", hostSize.width, hostSize.height);

      if (hostSize.width != 0 && hostSize.height != 0) {
        setSize(Size(hostSize.width, hostSize.height));
      }
    }

    /*
     * Children of a teleported portal are mounted under the host, so their
     * position on the screen has nothing to do with the ancestors of the
     * portal. `RootNodeKind` (the trait `<Modal>` uses for the same reason)
     * stops Fabric measurements at this node, and `getContentOriginOffset`
     * continues them from the position of the host.
     */
    void setTeleported(
        bool isTeleported,
        std::shared_ptr<const PortalShadowTreeAccess> shadowTreeAccess) {
      ensureUnsealed();

      shadowTreeAccess_ = std::move(shadowTreeAccess);

      if (isTeleported) {
        traits_.set(ShadowNodeTraits::Trait::RootNodeKind);
      } else {
        traits_.unset(ShadowNodeTraits::Trait::RootNodeKind);
      }
    }

    Transform getTransform() const override {
      if (!getTraits().check(ShadowNodeTraits::Trait::RootNodeKind)) {
        return ConcreteViewShadowNode::getTransform();
      }

      // a teleported portal is measured as a root, so it takes the transform
      // of the root: the offset of the surface inside the window
      auto rootShadowNode = getCommittedRoot(getSurfaceId());

      return rootShadowNode != nullptr ? rootShadowNode->getTransform() : Transform{};
    }

    Point getContentOriginOffset(bool includeTransform) const override {
      // `includeTransform` is `false` only for the lookups that go from a
      // parent to its children (`findNodeAtPoint`, DOM `scrollTop`)
      if (!includeTransform || !getTraits().check(ShadowNodeTraits::Trait::RootNodeKind)) {
        return ConcreteViewShadowNode::getContentOriginOffset(includeTransform);
      }

      return getHostOrigin();
    }

   private:
    // the tree of a surface as Fabric has committed it by this moment
    RootShadowNode::Shared getCommittedRoot(SurfaceId surfaceId) const {
      auto *revisionProvider =
          shadowTreeAccess_ != nullptr ? shadowTreeAccess_->revisionProvider.load() : nullptr;

      return revisionProvider != nullptr ? revisionProvider->getCurrentRevision(surfaceId) : nullptr;
    }

    /*
     * Position of the host in the same revision of the tree that is being
     * measured. It is resolved on demand, so it can't be stale: it accounts
     * for the layout, the transforms and the scroll offsets of the ancestors
     * of the host exactly as Fabric knows them at this moment.
     */
    Point getHostOrigin() const {
      auto hostFamily = PortalShadowRegistry::getInstance().getHostFamily(getStateData().hostTag);
      if (hostFamily == nullptr) {
        return {};
      }

      auto rootShadowNode = getCommittedRoot(hostFamily->getSurfaceId());
      if (rootShadowNode == nullptr) {
        return {};
      }

      auto hostMetrics = LayoutableShadowNode::computeRelativeLayoutMetrics(
          *hostFamily, *rootShadowNode, {.includeTransform = true});

      return hostMetrics.frame.origin;
    }

    std::shared_ptr<const PortalShadowTreeAccess> shadowTreeAccess_;
  };

} // namespace facebook::react
