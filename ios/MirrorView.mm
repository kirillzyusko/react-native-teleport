//
//  MirrorView.mm
//  Pods
//
//  Created by Kiryl Ziusko on 13/04/2026.
//

#import "MirrorView.h"
#import "PortalRegistry.h"
#import "PortalView.h"

#import <react/renderer/components/TeleportViewSpec/EventEmitters.h>
#import <react/renderer/components/TeleportViewSpec/Props.h>
#import <react/renderer/components/TeleportViewSpec/RCTComponentViewHelpers.h>
#import <react/renderer/components/TeleportViewSpec/RNTMirrorViewComponentDescriptor.h>

#import "RCTFabricComponentsPlugins.h"

using namespace facebook::react;

@interface MirrorView () <RCTMirrorViewViewProtocol>

@property (nonatomic, strong) NSString *portalName;
@property (nonatomic, strong) NSString *mode;
@property (nonatomic, assign) BOOL isWaitingForPortal;

// layer mode: UIImageView with a bitmap capture
@property (nonatomic, strong) UIImageView *imageView;

// snapshot mode: a UIView returned by snapshotView(afterScreenUpdates:)
@property (nonatomic, strong) UIView *snapshotSubview;

// live mode: CADisplayLink that continuously replaces a snapshot subview
@property (nonatomic, strong) CADisplayLink *displayLink;

// used by one-shot modes to retry until source has content
@property (nonatomic, assign) BOOL hasCaptured;

@end

@implementation MirrorView

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<MirrorViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const MirrorViewProps>();
    _props = defaultProps;

    _mode = @"layer";
  }

  return self;
}

// MARK: Props

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &newViewProps = *std::static_pointer_cast<MirrorViewProps const>(props);

  std::string newNameStr = newViewProps.name;
  NSString *newName =
      newNameStr.empty() ? nil : [NSString stringWithUTF8String:newNameStr.c_str()];

  std::string newModeStr = newViewProps.mode;
  NSString *newMode =
      newModeStr.empty() ? @"layer" : [NSString stringWithUTF8String:newModeStr.c_str()];

  BOOL nameChanged = ![self.portalName isEqualToString:newName];
  BOOL modeChanged = ![self.mode isEqualToString:newMode];

  if (nameChanged || modeChanged) {
    [self teardownCurrentMode];

    if (self.isWaitingForPortal && self.portalName) {
      [[PortalRegistry sharedInstance] unregisterPendingMirror:self withPortalName:self.portalName];
      self.isWaitingForPortal = NO;
    }

    self.portalName = newName;
    self.mode = newMode;
    self.hasCaptured = NO;

    if (self.portalName) {
      PortalView *portal = [[PortalRegistry sharedInstance] getPortalWithName:self.portalName];
      if (portal) {
        [self setupCurrentMode];
      } else {
        [[PortalRegistry sharedInstance] registerPendingMirror:self withPortalName:self.portalName];
        self.isWaitingForPortal = YES;
      }
    }
  }

  [super updateProps:props oldProps:oldProps];
}

- (void)onPortalAvailable
{
  self.isWaitingForPortal = NO;
  [self setupCurrentMode];
}

// MARK: Mode setup/teardown

- (void)teardownCurrentMode
{
  [self stopDisplayLink];

  if (self.imageView) {
    [self.imageView removeFromSuperview];
    self.imageView = nil;
  }

  if (self.snapshotSubview) {
    [self.snapshotSubview removeFromSuperview];
    self.snapshotSubview = nil;
  }
}

- (void)setupCurrentMode
{
  if ([self.mode isEqualToString:@"live"]) {
    [self setupLive];
  } else if ([self.mode isEqualToString:@"snapshot"]) {
    [self setupSnapshot];
  } else {
    // "layer" (default)
    [self setupLayer];
  }
}

// MARK: Live mode — snapshotView at display rate (lightweight system call)

- (void)setupLive
{
  [self startDisplayLink];
}

- (void)liveCaptureTick
{
  UIView *target = [self sourceView];
  if (!target || target.bounds.size.width == 0 || target.bounds.size.height == 0) {
    return;
  }

  UIView *snap = [target snapshotViewAfterScreenUpdates:NO];
  if (!snap) {
    return;
  }

  snap.contentMode = UIViewContentModeScaleToFill;
  snap.frame = self.bounds;

  if (self.snapshotSubview) {
    [self.snapshotSubview removeFromSuperview];
  }
  self.snapshotSubview = snap;
  [self addSubview:snap];
}

// MARK: Snapshot mode — one-time snapshotView

- (void)setupSnapshot
{
  // Use display link to retry until the source renders, then stop
  [self startDisplayLink];
}

- (void)snapshotCaptureTick
{
  if (self.hasCaptured) {
    return;
  }

  UIView *target = [self sourceView];
  if (!target || target.bounds.size.width == 0 || target.bounds.size.height == 0) {
    return;
  }

  UIView *snap = [target snapshotViewAfterScreenUpdates:NO];
  if (!snap) {
    return;
  }

  snap.contentMode = UIViewContentModeScaleToFill;
  snap.frame = self.bounds;
  snap.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;

  if (self.snapshotSubview) {
    [self.snapshotSubview removeFromSuperview];
  }
  self.snapshotSubview = snap;
  [self addSubview:snap];

  self.hasCaptured = YES;
  [self stopDisplayLink];
}

// MARK: Layer mode — one-time drawViewHierarchy → UIImage

- (void)setupLayer
{
  self.imageView = [[UIImageView alloc] initWithFrame:self.bounds];
  self.imageView.contentMode = UIViewContentModeScaleToFill;
  self.imageView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
  [self addSubview:self.imageView];

  // Use display link to retry until the source renders, then stop
  [self startDisplayLink];
}

- (void)layerCaptureTick
{
  if (self.hasCaptured) {
    return;
  }

  UIView *target = [self sourceView];
  if (!target || target.bounds.size.width == 0 || target.bounds.size.height == 0) {
    return;
  }

  CGRect bounds = target.bounds;
  UIGraphicsBeginImageContextWithOptions(bounds.size, NO, 0.0);
  BOOL success = [target drawViewHierarchyInRect:bounds afterScreenUpdates:NO];
  UIImage *snapshot = UIGraphicsGetImageFromCurrentImageContext();
  UIGraphicsEndImageContext();

  if (success && snapshot) {
    self.imageView.image = snapshot;
    self.hasCaptured = YES;
    [self stopDisplayLink];
  }
}

// MARK: Helpers

- (UIView *)sourceView
{
  if (!self.portalName) {
    return nil;
  }

  PortalView *portal = [[PortalRegistry sharedInstance] getPortalWithName:self.portalName];
  if (!portal) {
    return nil;
  }

  return [portal captureTarget];
}

// MARK: Display link

- (void)startDisplayLink
{
  if (self.displayLink) {
    return;
  }

  self.displayLink = [CADisplayLink displayLinkWithTarget:self selector:@selector(displayLinkFired:)];
  [self.displayLink addToRunLoop:[NSRunLoop mainRunLoop] forMode:NSRunLoopCommonModes];
}

- (void)stopDisplayLink
{
  [self.displayLink invalidate];
  self.displayLink = nil;
}

- (void)displayLinkFired:(CADisplayLink *)link
{
  if ([self.mode isEqualToString:@"live"]) {
    [self liveCaptureTick];
  } else if ([self.mode isEqualToString:@"snapshot"]) {
    [self snapshotCaptureTick];
  } else {
    [self layerCaptureTick];
  }
}

// MARK: Layout

- (void)layoutSubviews
{
  [super layoutSubviews];

  if (self.imageView) {
    self.imageView.frame = self.bounds;
  }
  if (self.snapshotSubview) {
    self.snapshotSubview.frame = self.bounds;
  }
}

// MARK: Cleanup

- (void)prepareForRecycle
{
  [super prepareForRecycle];

  [self teardownCurrentMode];

  if (self.isWaitingForPortal && self.portalName) {
    [[PortalRegistry sharedInstance] unregisterPendingMirror:self withPortalName:self.portalName];
    self.isWaitingForPortal = NO;
  }

  self.portalName = nil;
  self.mode = @"layer";
  self.hasCaptured = NO;
}

- (void)dealloc
{
  [self stopDisplayLink];
}

Class<RCTComponentViewProtocol> MirrorViewCls(void)
{
  return MirrorView.class;
}

@end
