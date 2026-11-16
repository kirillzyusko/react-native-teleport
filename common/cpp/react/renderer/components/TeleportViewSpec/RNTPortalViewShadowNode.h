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

#include <memory>
#include <utility>

namespace facebook::react {

  JSI_EXPORT extern const char PortalViewComponentName[];

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

      // the transform of a root is the offset of its surface inside the window
      auto viewportOffset = PortalShadowRegistry::getInstance().getViewportOffset(getSurfaceId());

      return Transform::Translate(viewportOffset.x, viewportOffset.y, 0);
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
    /*
     * Position of the host in the same revision of the tree that is being
     * measured. It is resolved on demand, so it can't be stale: it accounts
     * for the layout, the transforms and the scroll offsets of the ancestors
     * of the host exactly as Fabric knows them at this moment.
     */
    Point getHostOrigin() const {
      static thread_local int depth = 0;
      // a host can be mounted inside the content of another portal, but
      // a portal can't be measured through itself
      if (depth > 8) {
        return {};
      }

      auto hostFamily = PortalShadowRegistry::getInstance().getHostFamily(getStateData().hostTag);
      auto *revisionProvider =
          shadowTreeAccess_ != nullptr ? shadowTreeAccess_->revisionProvider.load() : nullptr;
      if (hostFamily == nullptr || revisionProvider == nullptr) {
        return {};
      }

      auto rootShadowNode = revisionProvider->getCurrentRevision(hostFamily->getSurfaceId());
      if (rootShadowNode == nullptr) {
        return {};
      }

      depth++;
      auto hostMetrics = LayoutableShadowNode::computeRelativeLayoutMetrics(
          *hostFamily, *rootShadowNode, {.includeTransform = true});
      depth--;

      return hostMetrics.frame.origin;
    }

    std::shared_ptr<const PortalShadowTreeAccess> shadowTreeAccess_;
  };

} // namespace facebook::react
