import { useState } from 'react';
import { BookOpen, Calendar, Star, FileText, Clock, CheckCircle, TrendingUp, Flame, AlertTriangle, Sparkles, Smile, Frown, Meh, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { toast } from 'sonner';

const mockIssuedBooks = [
  { 
    id: '1', 
    title: 'To Kill a Mockingbird', 
    totalPages: 324,
    currentPage: 120,
    issueDate: '2025-12-20',
    returnDate: '2026-01-20',
    status: 'Active'
  },
  { 
    id: '2', 
    title: '1984', 
    totalPages: 328,
    currentPage: 280,
    issueDate: '2025-12-15',
    returnDate: '2026-01-10',
    status: 'Overdue'
  },
  { 
    id: '3', 
    title: 'The Great Gatsby', 
    totalPages: 180,
    currentPage: 78,
    issueDate: '2026-01-01',
    returnDate: '2026-01-25',
    status: 'Active'
  },
];

const initialReports = [
  {
    id: '1',
    bookId: '1',
    bookName: 'To Kill a Mockingbird',
    date: '2026-01-04',
    pagesFrom: 100,
    pagesTo: 120,
    timeSpent: 45,
    summary: 'Explored the themes of racial injustice and moral growth through Scout\'s perspective.',
    rating: 5,
    mood: 'focused',
    status: 'Approved',
  },
  {
    id: '2',
    bookId: '1',
    bookName: 'To Kill a Mockingbird',
    date: '2026-01-03',
    pagesFrom: 80,
    pagesTo: 100,
    timeSpent: 35,
    summary: 'Scout and Jem\'s adventures continue. The character development is excellent.',
    rating: 4,
    mood: 'relaxed',
    status: 'Pending',
  },
  {
    id: '3',
    bookId: '1',
    bookName: 'To Kill a Mockingbird',
    date: '2026-01-02',
    pagesFrom: 60,
    pagesTo: 80,
    timeSpent: 40,
    summary: 'The courtroom scenes are gripping. Atticus is an inspiring character.',
    rating: 5,
    mood: 'focused',
    status: 'Approved',
  },
];

export default function DailyReadingReport() {
  const [reports, setReports] = useState(initialReports);
  const [selectedBookId, setSelectedBookId] = useState('1');
  const [showForm, setShowForm] = useState(false);
  const [readingDate, setReadingDate] = useState('');
  const [pagesFrom, setPagesFrom] = useState('');
  const [pagesTo, setPagesTo] = useState('');
  const [timeSpent, setTimeSpent] = useState('');
  const [summary, setSummary] = useState('');
  const [rating, setRating] = useState(0);
  const [mood, setMood] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const selectedBook = mockIssuedBooks.find(b => b.id === selectedBookId);
  const bookReports = reports.filter(r => r.bookId === selectedBookId);
  
  // Calculate statistics
  const pagesRead = selectedBook?.currentPage || 0;
  const totalPages = selectedBook?.totalPages || 0;
  const remainingPages = totalPages - pagesRead;
  const progressPercentage = totalPages > 0 ? Math.round((pagesRead / totalPages) * 100) : 0;
  
  // Calculate days remaining
  const today = new Date('2026-01-05'); // Current date
  const returnDate = selectedBook ? new Date(selectedBook.returnDate) : new Date();
  const daysRemaining = Math.ceil((returnDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const isOverdue = daysRemaining < 0;
  const overdueDays = Math.abs(daysRemaining);
  
  // Calculate reading streak
  const readingStreak = 3; // Mock data - consecutive days of reading
  
  // Calculate average pages per day
  const totalReports = bookReports.length;
  const avgPagesPerDay = totalReports > 0 
    ? Math.round(bookReports.reduce((sum, r) => sum + (r.pagesTo - r.pagesFrom), 0) / totalReports)
    : 0;
  
  // Calculate days to finish
  const daysToFinish = avgPagesPerDay > 0 ? Math.ceil(remainingPages / avgPagesPerDay) : 0;

  const handleSubmitReport = (isDraft = false) => {
    if (!selectedBookId || !readingDate || !pagesFrom || !pagesTo || !timeSpent || !summary || rating === 0) {
      toast.error('Please fill in all fields');
      return;
    }

    const book = mockIssuedBooks.find((b) => b.id === selectedBookId);
    if (!book) return;

    const newReport = {
      id: Date.now().toString(),
      bookId: selectedBookId,
      bookName: book.title,
      date: readingDate,
      pagesFrom: parseInt(pagesFrom),
      pagesTo: parseInt(pagesTo),
      timeSpent: parseInt(timeSpent),
      summary,
      rating,
      mood,
      status: 'Pending',
    };

    setReports([newReport, ...reports]);
    setShowSuccess(true);
    
    if (isDraft) {
      toast.success('Report saved as draft!');
    } else {
      toast.success('Reading report submitted successfully!');
    }

    // Reset form
    setReadingDate('');
    setPagesFrom('');
    setPagesTo('');
    setTimeSpent('');
    setSummary('');
    setRating(0);
    setMood('');
    setShowForm(false);

    setTimeout(() => setShowSuccess(false), 3000);
  };

  const StarRating = ({ value, onChange }) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="focus:outline-none transition-colors"
          >
            <Star
              className={`w-6 h-6 ${
                star <= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Approved':
        return 'bg-green-100 text-green-700 hover:bg-green-100';
      case 'Pending':
        return 'bg-amber-100 text-amber-700 hover:bg-amber-100';
      case 'Needs Improvement':
        return 'bg-red-100 text-red-700 hover:bg-red-100';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getBookStatusColor = (status) => {
    switch (status) {
      case 'Active':
        return 'bg-blue-100 text-blue-700 hover:bg-blue-100';
      case 'Overdue':
        return 'bg-red-100 text-red-700 hover:bg-red-100';
      case 'Completed':
        return 'bg-green-100 text-green-700 hover:bg-green-100';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className=" space-y-6">
        {/* Page Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-semibold text-gray-900">My Reading Report</h1>
              <p className="text-sm text-gray-600 mt-1">Track your daily reading and progress</p>
            </div>
          </div>

          {/* Book Selector */}
          <div className="flex items-center gap-3 mt-4">
            <div className="flex-1 max-w-md">
              <Select value={selectedBookId} onValueChange={setSelectedBookId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {mockIssuedBooks.map((book) => (
                    <SelectItem key={book.id} value={book.id}>
                      {book.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedBook && (
              <Badge className={getBookStatusColor(selectedBook.status)}>
                {selectedBook.status}
              </Badge>
            )}
          </div>
        </div>

        {/* Success Message */}
        {showSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <p className="text-green-800">Your reading report has been submitted successfully!</p>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Total Pages */}
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <BookOpen className="w-4 h-4 text-gray-600" />
                <p className="text-xs text-gray-600">Total Pages</p>
              </div>
              <p className="text-2xl font-semibold text-gray-900">{totalPages}</p>
            </CardContent>
          </Card>

          {/* Pages Read */}
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <p className="text-xs text-gray-600">Pages Read</p>
              </div>
              <p className="text-2xl font-semibold text-blue-600">{pagesRead}</p>
              <p className="text-xs text-gray-500">{progressPercentage}%</p>
            </CardContent>
          </Card>

          {/* Remaining Pages */}
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-gray-600" />
                <p className="text-xs text-gray-600">Remaining</p>
              </div>
              <p className="text-2xl font-semibold text-gray-900">{remainingPages}</p>
            </CardContent>
          </Card>

          {/* Days Remaining / Overdue */}
          {isOverdue ? (
            <Card className="shadow-sm border-red-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <p className="text-xs text-red-600">Overdue</p>
                </div>
                <p className="text-2xl font-semibold text-red-600">{overdueDays}</p>
                <p className="text-xs text-red-500">days</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-gray-600" />
                  <p className="text-xs text-gray-600">Days Left</p>
                </div>
                <p className="text-2xl font-semibold text-gray-900">{daysRemaining}</p>
              </CardContent>
            </Card>
          )}

          {/* Reading Streak */}
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Flame className="w-4 h-4 text-orange-600" />
                <p className="text-xs text-gray-600">Streak</p>
              </div>
              <p className="text-2xl font-semibold text-orange-600">{readingStreak}</p>
              <p className="text-xs text-gray-500">days</p>
            </CardContent>
          </Card>

          {/* Avg Pages/Day */}
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <p className="text-xs text-gray-600">Avg/Day</p>
              </div>
              <p className="text-2xl font-semibold text-green-600">{avgPagesPerDay}</p>
              <p className="text-xs text-gray-500">pages</p>
            </CardContent>
          </Card>
        </div>

        {/* Progress Bar */}
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">Reading Progress</h3>
                <span className="text-sm font-medium text-blue-600">{progressPercentage}%</span>
              </div>
              <Progress value={progressPercentage} className="h-3" />
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>Page {pagesRead} of {totalPages}</span>
                <span>{remainingPages} pages remaining</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Smart Insights Panel */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900">Reading Pace</p>
                  <p className="text-sm text-blue-700 mt-1">
                    {daysToFinish > 0 
                      ? `At your current pace, you'll finish in ${daysToFinish} days`
                      : 'Keep up the great work!'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium text-green-900">Motivation</p>
                  <p className="text-sm text-green-700 mt-1">
                    {progressPercentage >= 70 
                      ? "Great job! You're almost there!"
                      : progressPercentage >= 40
                      ? "You're making excellent progress!"
                      : "Keep going! Every page counts!"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Create Report Button */}
        {!showForm && (
          <Button 
            onClick={() => setShowForm(true)} 
            className="w-full bg-blue-600 hover:bg-blue-700"
            size="lg"
          >
            <FileText className="w-5 h-5 mr-2" />
            Create New Reading Report
          </Button>
        )}

        {/* Report Submission Form */}
        {showForm && (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Submit Today's Reading</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Reading Date */}
                <div className="space-y-2">
                  <Label htmlFor="date" className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Reading Date
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={readingDate}
                    onChange={(e) => setReadingDate(e.target.value)}
                  />
                </div>

                {/* Pages Read */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pagesFrom">Pages Read (From)</Label>
                    <Input
                      id="pagesFrom"
                      type="number"
                      placeholder="e.g., 45"
                      value={pagesFrom}
                      onChange={(e) => setPagesFrom(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pagesTo">Pages Read (To)</Label>
                    <Input
                      id="pagesTo"
                      type="number"
                      placeholder="e.g., 70"
                      value={pagesTo}
                      onChange={(e) => setPagesTo(e.target.value)}
                    />
                  </div>
                </div>

                {/* Time Spent */}
                <div className="space-y-2">
                  <Label htmlFor="timeSpent" className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Time Spent Reading (minutes)
                  </Label>
                  <Input
                    id="timeSpent"
                    type="number"
                    placeholder="e.g., 45"
                    value={timeSpent}
                    onChange={(e) => setTimeSpent(e.target.value)}
                  />
                </div>

                {/* Mood / Focus Selector */}
                <div className="space-y-2">
                  <Label htmlFor="mood">Mood / Focus</Label>
                  <Select value={mood} onValueChange={setMood}>
                    <SelectTrigger id="mood">
                      <SelectValue placeholder="How was your reading session?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="focused">
                        <div className="flex items-center gap-2">
                          <Smile className="w-4 h-4" />
                          Focused & Engaged
                        </div>
                      </SelectItem>
                      <SelectItem value="relaxed">
                        <div className="flex items-center gap-2">
                          <Meh className="w-4 h-4" />
                          Relaxed & Calm
                        </div>
                      </SelectItem>
                      <SelectItem value="distracted">
                        <div className="flex items-center gap-2">
                          <Frown className="w-4 h-4" />
                          Distracted
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Summary */}
                <div className="space-y-2">
                  <Label htmlFor="summary" className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Short Summary
                  </Label>
                  <Textarea
                    id="summary"
                    placeholder="Share your thoughts about today's reading..."
                    rows={4}
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                  />
                </div>

                {/* Rating */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Star className="w-4 h-4" />
                    Self Rating
                  </Label>
                  <StarRating value={rating} onChange={setRating} />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button 
                    onClick={() => handleSubmitReport(false)} 
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    Submit Today's Reading
                  </Button>
                  <Button 
                    onClick={() => handleSubmitReport(true)} 
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Save as Draft
                  </Button>
                </div>
                
                <Button 
                  onClick={() => setShowForm(false)} 
                  variant="ghost"
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reading History Section */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Reading History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {bookReports.map((report) => (
                <div
                  key={report.id}
                  className="border rounded-lg p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                        <span className="flex items-center gap-1 font-medium text-gray-900">
                          <Calendar className="w-4 h-4" />
                          {new Date(report.date).toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </span>
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-4 h-4" />
                          Pages {report.pagesFrom} - {report.pagesTo} ({report.pagesTo - report.pagesFrom} pages)
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {report.timeSpent} mins
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${
                              i < report.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                            }`}
                          />
                        ))}
                        {report.mood && (
                          <span className="text-xs text-gray-500 ml-2 capitalize">
                            • {report.mood}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700">{report.summary}</p>
                    </div>
                    <Badge className={`${getStatusColor(report.status)} flex items-center gap-1 ml-4`}>
                      {report.status === 'Approved' && <CheckCircle className="w-3 h-3" />}
                      {report.status === 'Pending' && <Clock className="w-3 h-3" />}
                      {report.status === 'Needs Improvement' && <AlertTriangle className="w-3 h-3" />}
                      {report.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}