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
       
          <Route path="books" element=
          {<Suspense fallback={<Loader size="lg" colorClass="text-orange-600" />}>
          <BookTable /></Suspense>} />
          <Route path="books/:id" element={<BookDetails />} />
          <Route path="members" element={<Suspense fallback={<Loader size="lg" colorClass="text-orange-600" />}><MemberTable /></Suspense>} />
          <Route path="members/new"  element={<Suspense fallback={<Loader size="lg" colorClass="text-orange-600" />}><MembersForm /></Suspense>} />
          <Route path="members/edit/:id"  element={<Suspense fallback={<Loader size="lg" colorClass="text-orange-600" />}><MembersForm /></Suspense>} />
          <Route path="members/:id" element={<MemberDetails />} />
          <Route index element={<DashboardPage />} />
        </Route>
      </Routes>

  );
}

export default App;