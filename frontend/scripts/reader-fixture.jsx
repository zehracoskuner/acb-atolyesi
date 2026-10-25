import { MembershipContext } from "../src/lib/membershipContext";
import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Read from "../src/pages/Read.jsx";
createRoot(document.getElementById("root")).render(<MembershipContext.Provider value={{ requireMember: () => false }}><MemoryRouter initialEntries={["/read/work1?chapter=chapter1&restart=true"]}><Routes><Route path="/read/:workId" element={<Read />} /></Routes></MemoryRouter></MembershipContext.Provider>);
