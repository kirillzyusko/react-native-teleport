export type PortalProviderProps = {
  children: React.ReactNode;
};
export type PortalHostProps = {
  name: string;
  children: React.ReactNode;
};
export type PortalProps = {
  hostName?: string;
  children: React.ReactNode;
};
