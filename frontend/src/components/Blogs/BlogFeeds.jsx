import { useState } from 'react';
import { motion } from 'motion/react';
import { BookOpen, Search, Plus, Heart, MessageCircle, Clock, Eye, TrendingUp, Sparkles, Filter } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';

interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  coverImage: string;
  author: {
    name: string;
    avatar: string;
    role: 'Member' | 'Moderator';
  };
  readingTime: number;
  publishDate: string;
  likes: number;
  comments: number;
  views: number;
  tags: string[];
  bookRelated?: string;
  featured?: boolean;
  trending?: boolean;
}

const mockBlogPosts: BlogPost[] = [
  {
    id: '1',
    title: 'The Power of Atomic Habits: How Small Changes Lead to Remarkable Results',
    excerpt: 'After finishing James Clear\'s Atomic Habits, I\'ve discovered that building better habits isn\'t about massive transformations...',
    coverImage: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=800&h=400&fit=crop',
    author: {
      name: 'Sarah Johnson',
      avatar: 'https://i.pravatar.cc/150?img=1',
      role: 'Moderator',
    },
    readingTime: 5,
    publishDate: '2026-01-10',
    likes: 234,
    comments: 45,
    views: 1250,
    tags: ['Self-Improvement', 'Habits', 'Productivity'],
    bookRelated: 'Atomic Habits',
    featured: true,
  },
  {
    id: '2',
    title: 'Why 1984 Still Resonates Today: A Modern Perspective',
    excerpt: 'George Orwell\'s dystopian masterpiece continues to be relevant in our digital age. The themes of surveillance, truth manipulation...',
    coverImage: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=800&h=400&fit=crop',
    author: {
      name: 'Michael Chen',
      avatar: 'https://i.pravatar.cc/150?img=12',
      role: 'Member',
    },
    readingTime: 7,
    publishDate: '2026-01-09',
    likes: 189,
    comments: 32,
    views: 890,
    tags: ['Classic Literature', 'Social Commentary', 'Dystopian'],
    bookRelated: '1984',
    trending: true,
  },
  {
    id: '3',
    title: 'Building a Consistent Reading Habit: My Journey',
    excerpt: 'Three months ago, I committed to reading 30 minutes daily. Here\'s what I learned about consistency, motivation, and the joy of reading...',
    coverImage: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=800&h=400&fit=crop',
    author: {
      name: 'Emma Wilson',
      avatar: 'https://i.pravatar.cc/150?img=5',
      role: 'Member',
    },
    readingTime: 4,
    publishDate: '2026-01-08',
    likes: 156,
    comments: 28,
    views: 654,
    tags: ['Reading Tips', 'Personal Growth', 'Habits'],
  },
  {
    id: '4',
    title: 'The Great Gatsby: Symbolism and the American Dream',
    excerpt: 'F. Scott Fitzgerald\'s use of symbolism throughout The Great Gatsby creates layers of meaning that go far beyond the surface narrative...',
    coverImage: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800&h=400&fit=crop',
    author: {
      name: 'David Martinez',
      avatar: 'https://i.pravatar.cc/150?img=8',
      role: 'Moderator',
    },
    readingTime: 6,
    publishDate: '2026-01-07',
    likes: 198,
    comments: 41,
    views: 987,
    tags: ['Classic Literature', 'Literary Analysis', 'American Literature'],
    bookRelated: 'The Great Gatsby',
  },
  {
    id: '5',
    title: 'My Top 10 Book Recommendations for 2026',
    excerpt: 'As we start a new year, I wanted to share my favorite books that have shaped my thinking and inspired me to become a better reader...',
    coverImage: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&h=400&fit=crop',
    author: {
      name: 'Lisa Anderson',
      avatar: 'https://i.pravatar.cc/150?img=9',
      role: 'Member',
    },
    readingTime: 8,
    publishDate: '2026-01-06',
    likes: 312,
    comments: 67,
    views: 1543,
    tags: ['Book Recommendations', 'Reading Lists', 'Reviews'],
    trending: true,
  },
];

interface BlogFeedProps {
  onWriteClick: () => void;
  onPostClick: (postId: string) => void;
}

export function BlogFeed({ onWriteClick, onPostClick }: BlogFeedProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('latest');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Get all unique tags
  const allTags = Array.from(
    new Set(mockBlogPosts.flatMap((post) => post.tags))
  );

  const filteredPosts = mockBlogPosts.filter((post) => {
    const matchesSearch =
      searchQuery === '' ||
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.author.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTags =
      selectedTags.length === 0 ||
      selectedTags.some((tag) => post.tags.includes(tag));

    return matchesSearch && matchesTags;
  });

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const featuredPost = mockBlogPosts.find((post) => post.featured);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
      },
    },
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Community Blog</h1>
            <p className="text-gray-600">Share your reading journey and insights</p>
          </div>
          <Button
            onClick={onWriteClick}
            className="bg-blue-600 hover:bg-blue-700 shadow-sm"
            size="lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Write a Post
          </Button>
        </div>

        {/* Search & Filters */}
        <Card className="mb-6 shadow-sm">
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Search bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="Search by title, tag, or author..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filter tabs */}
              <div className="flex items-center justify-between flex-wrap gap-4">
                <Tabs value={selectedFilter} onValueChange={setSelectedFilter}>
                  <TabsList>
                    <TabsTrigger value="latest">Latest</TabsTrigger>
                    <TabsTrigger value="trending">
                      <TrendingUp className="w-4 h-4 mr-1" />
                      Trending
                    </TabsTrigger>
                    <TabsTrigger value="reviews">Book Reviews</TabsTrigger>
                    <TabsTrigger value="reflections">Reflections</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Tag chips */}
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                    className={`cursor-pointer transition-all ${
                      selectedTags.includes(tag)
                        ? 'bg-blue-600 hover:bg-blue-700'
                        : 'hover:bg-gray-100'
                    }`}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Featured Post */}
        {featuredPost && selectedFilter === 'latest' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-yellow-500" />
              <span className="text-sm font-semibold text-gray-700">Featured Post</span>
            </div>
            <Card
              className="overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group"
              onClick={() => onPostClick(featuredPost.id)}
            >
              <div className="relative h-64 overflow-hidden">
                <img
                  src={featuredPost.coverImage}
                  alt={featuredPost.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-4 left-4">
                  <Badge className="bg-yellow-500 text-white hover:bg-yellow-600">
                    Featured
                  </Badge>
                </div>
              </div>
              <CardContent className="p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                  {featuredPost.title}
                </h2>
                <p className="text-gray-600 mb-4 line-clamp-2">{featuredPost.excerpt}</p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={featuredPost.author.avatar} />
                      <AvatarFallback>{featuredPost.author.name[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{featuredPost.author.name}</p>
                        <Badge
                          variant="outline"
                          className={
                            featuredPost.author.role === 'Moderator'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }
                        >
                          {featuredPost.author.role}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>
                          {new Date(featuredPost.publishDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {featuredPost.readingTime} min read
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Heart className="w-4 h-4" />
                      {featuredPost.likes}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-4 h-4" />
                      {featuredPost.comments}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                  {featuredPost.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Blog Posts Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {filteredPosts
            .filter((post) => !post.featured)
            .map((post) => (
              <motion.div key={post.id} variants={itemVariants}>
                <Card
                  className="overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer group h-full flex flex-col"
                  onClick={() => onPostClick(post.id)}
                >
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={post.coverImage}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {post.trending && (
                      <div className="absolute top-3 left-3">
                        <Badge className="bg-orange-500 text-white hover:bg-orange-600 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          Trending
                        </Badge>
                      </div>
                    )}
                    {post.bookRelated && (
                      <div className="absolute bottom-3 left-3">
                        <Badge className="bg-white/90 backdrop-blur-sm text-gray-800 hover:bg-white flex items-center gap-1">
                          <BookOpen className="w-3 h-3" />
                          {post.bookRelated}
                        </Badge>
                      </div>
                    )}
                  </div>

                  <CardContent className="p-5 flex-1 flex flex-col">
                    <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
                      {post.title}
                    </h3>
                    <p className="text-gray-600 mb-4 line-clamp-2 flex-1">{post.excerpt}</p>

                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={post.author.avatar} />
                          <AvatarFallback>{post.author.name[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900">
                              {post.author.name}
                            </p>
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                post.author.role === 'Moderator'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                              }`}
                            >
                              {post.author.role}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>
                              {new Date(post.publishDate).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {post.readingTime} min
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm text-gray-500 pt-2 border-t">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 hover:text-red-500 transition-colors">
                            <Heart className="w-4 h-4" />
                            {post.likes}
                          </span>
                          <span className="flex items-center gap-1 hover:text-blue-500 transition-colors">
                            <MessageCircle className="w-4 h-4" />
                            {post.comments}
                          </span>
                          <span className="flex items-center gap-1">
                            <Eye className="w-4 h-4" />
                            {post.views}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {post.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
        </motion.div>

        {filteredPosts.length === 0 && (
          <div className="text-center py-16">
            <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No posts found</h3>
            <p className="text-gray-500">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
