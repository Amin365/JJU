import React, { Suspense, lazy } from "react";
import { Routes, Route } from "react-router";
import ProtectedRoute from "./pages/ProtectedRoute";
import Loader from "./components/Loader";


// lazy-loaded route components
const DashboardPage = lazy(() => import("./pages/Dashboard"));
const Test = lazy(() => import("./pages/Test"));
const TestTwo = lazy(() => import("./pages/TestTwo"));
const LoginPage = lazy(() => import("./pages/Loginpage"));
const BookTable = lazy(() => import("./components/Books/BookTable"));
const BookDetails = lazy(() => import("./components/Books/BookDetails"));
const MembersForm = lazy(() => import("./components/Members/MemberForm"));
const MemberTable = lazy(() => import("./components/Members/MembersTable"));
const MemberDetails = lazy(() => import("./components/Members/MemberDetails"));
const SectionCards = lazy(() =>
  import("./components/Section-cards").then((m) => ({ default: m.SectionCards }))
);

const Users = lazy(() => import("./components/Users/UserTable"));
const UsersFromMember = lazy(() => import("./components/Users/UserFromMember"));


function App() {
  return (
 
      <Routes>
        {/* auth */}
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        >
          <Route
            index
            element={
              <Suspense fallback={<Loader size="lg" colorClass="text-orange-600" />}>
                <SectionCards />
              </Suspense>
            }
          />
       
          <Route path="books" element=
          {<Suspense fallback={<Loader size="lg" colorClass="text-orange-600" />}>
          <BookTable /></Suspense>} />

          <Route path="books/:id" element={<BookDetails />} />
          <Route path="members" element={<Suspense fallback={<Loader size="lg" colorClass="text-orange-600" />}><MemberTable /></Suspense>} />
          <Route path="members/new"  element={<Suspense fallback={<Loader size="lg" colorClass="text-orange-600" />}><MembersForm /></Suspense>} />
          <Route path="members/edit/:id"  element={<Suspense fallback={<Loader size="lg" colorClass="text-orange-600" />}><MembersForm /></Suspense>} />
          <Route path="members/:id" element={<MemberDetails />} />
          <Route path="users" element={<Suspense fallback={<Loader size="lg" colorClass="text-orange-600" />}><Users /></Suspense>} />
  <Route path="users/new" element={<Suspense fallback={<Loader size="lg" colorClass="text-orange-600" />}><UsersFromMember /></Suspense>} />
        </Route>
      </Routes>

  );
}

export default App;