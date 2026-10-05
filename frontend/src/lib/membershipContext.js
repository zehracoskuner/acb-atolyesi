import { createContext, useContext } from "react";
export const MembershipContext = createContext(null);
export const useMembership = () => useContext(MembershipContext);
