export type PortalProviderProps = {
  children: React.ReactNode;
};
export type PortalHostProps<S> = {
  name: string;
  style?: S;
  children?: React.ReactNode;
};
export type PortalProps<S> = {
  name?: string;
  hostName?: string;
  style?: S;
  children?: React.ReactNode;
};
