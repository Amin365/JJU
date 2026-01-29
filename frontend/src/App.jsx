import React, { Suspense, lazy } from "react";
import { Routes, Route } from "react-router";
import ProtectedRoute from "./pages/ProtectedRoute";
import Loader from "./components/Loader";
import ReadingRecaps from "./components/Members/ReadingRecap";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import ScrollToHash from "./components/ScrollToHash";


// lazy-loaded route components
const DashboardPage = lazy(() => import("./pages/Dashboard"));

const LoginPage = lazy(() => import("./pages/Loginpage"));
const ForgotPassword = lazy(() => import("./components/login/ForgetPassword"));
const ResetPassword = lazy(() => import("./components/login/ResetPasswordForm"));
const VerifyOtp= lazy(() => import("./components/login/VerifyOtp"));
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
const Report = lazy(() => import("./components/Members/DailyReport"));
// const Report= lazy(()=>import('./components/Members/DailyReport'))
const MemberGate=lazy(()=>import( "./components/Issue/IssueMemberGate"));
const IssueMembersForm=lazy(()=>import( "./components/Issue/IssueForm"));
const Issuetable=lazy(()=>import( "./components/Issue/IssueTable"));
const DailyActivity=lazy(()=>import('./components/Members/DailyActivity'));
const ModeratorTable=lazy(()=>import('./components/Moderator/Moderator'));
const ModeratorPage=lazy(()=>import('./components/Moderator/ModeratorTable'));
const ReportRecap=lazy(()=>import('./components/Members/ReadingRecap'));
const BlogEdit=lazy(()=>import('./components/Blogs/BlogEdit'));
const BlogTable=lazy(()=>import('./components/Blogs/BlogTable'));
const BlogDetails=lazy(()=>import('./components/Blogs/BlogDetails'));
const BlogFeeds=lazy(()=>import('./components/Blogs/BlogFeeds'));
const Homepage=lazy(()=>import("./components/Homepage/Herroes"))
const JoinClub=lazy(()=>import("./components/Homepage/JoinClubsTable"))
const Profile = lazy(() => import("./components/Users/UserProfile"));
const IDcard = lazy(() => import("./components/IDcard/PVCIDCard"));
const MembersFormPublic = lazy(() => import("./components/Members/MemberForm"));
function App() {
  return (
    <>
      <PWAInstallPrompt />
      <ScrollToHash/>
 
      <Routes>
        {/* auth */}
        <Route path="/login" element={<LoginPage />} />
       
        <Route path="/" element={<Homepage />} />
          <Route path="/blogs/:id" element={<Suspense fallback={<Loader size="lg" colorClass="text-orange-600" />}><BlogDetails /></Suspense>} />
               <Route path="/blogs" element={<Suspense fallback={<Loader size="lg" colorClass="text-orange-600" />}><BlogFeeds /></Suspense>} />
        <Route path="/members/new" element={<Suspense fallback={<Loader size="lg" colorClass="text-orange-600" />}><MembersFormPublic /></Suspense>} />

 <Route path="/forgot-password" element= { <Suspense fallback={<Loader size="lg" colorClass="text-orange-600" />}><ForgotPassword /></Suspense>} />
<Route path="/verify-otp" element= { <Suspense fallback={<Loader size="lg" colorClass="text-orange-600" />}><VerifyOtp /></Suspense>} />
<Route path="/reset-password" element= { <Suspense fallback={<Loader size="lg" colorClass="text-orange-600" />}><ResetPassword /></Suspense>} />
        {/* protected routes */}
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
  <Route path="report" element={<Suspense fallback={<Loader size="lg" colorClass="text-orange-600" />}><Report /></Suspense>} />
  <Route path="issues/request" element={<Suspense fallback={<Loader size="lg" colorClass="text-orange-600" />}><MemberGate /></Suspense>} />
<Route path="issue/new" element={<Suspense fallback={<Loader size="lg" colorClass="text-orange-600" />}><IssueMembersForm /></Suspense>} />
  <Route path="issues" element={<Suspense fallback={<Loader size="lg" colorClass="text-orange-600" />}><Issuetable /></Suspense>} />
  <Route path="activity" element={<Suspense fallback={<Loader size="lg" colorClass="text-orange-600" />}><DailyActivity /></Suspense>} />
  <Route path="moderators" element={<Suspense fallback={<Loader size="lg" colorClass="text-orange-600" />}><ModeratorTable /></Suspense>} />
  <Route path="moderators/:moderatorId/members" element={<Suspense fallback={<Loader size="lg" colorClass="text-orange-600" />}><ModeratorPage /></Suspense>} />
  <Route path="report-recap" element={<Suspense fallback={<Loader size="lg" colorClass="text-orange-600" />}><ReportRecap /></Suspense>} />
  <Route path="blogs/new" element={<Suspense fallback={<Loader size="lg" colorClass="text-orange-600" />}><BlogEdit /></Suspense>} />
  <Route path="blogs/edit/:id" element={<Suspense fallback={<Loader size="lg" colorClass="text-orange-600" />}><BlogEdit /></Suspense>} />
  <Route path="blogs/:id" element={<Suspense fallback={<Loader size="lg" colorClass="text-orange-600" />}><BlogDetails /></Suspense>} />
  <Route path="blogs" element={<Suspense fallback={<Loader size="lg" colorClass="text-orange-600" />}><BlogTable /></Suspense>} />
  <Route path="profile" element={<Suspense fallback={<Loader size="lg" colorClass="text-orange-600" />}><Profile /></Suspense>} />
  <Route path="id-card/:memberId" element={<Suspense fallback={<Loader size="lg" colorClass="text-orange-600" />}><IDcard /></Suspense>} />
  <Route path="join-clubs" element={<Suspense fallback={<Loader size="lg" colorClass="text-orange-600" />}><JoinClub /></Suspense>} />
        </Route>
      </Routes>
      </>

  );
}

export default App;