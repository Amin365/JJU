import React from "react";

export default function Example() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap');
        * { font-family: 'Poppins', sans-serif; }
      `}</style>

      {/* Header */}
      <div className="mx-auto max-w-5xl px-6 pt-16 text-center">
        <h2 className="text-balance text-3xl font-semibold text-gray-900 md:text-4xl">
          Join Our Community
        </h2>
        <p className="mt-3 text-sm text-gray-600 md:text-base">
          Meet readers, share ideas, and grow your skills together.
        </p>
      </div>

      {/* Card (background removed) */}
      <div className="max-w-5xl md:w-full mx-2 md:mx-auto mt-10 flex flex-col items-center justify-center text-center rounded-2xl p-10 border border-zinc-200 bg-white text-zinc-900">
        <div className="flex flex-wrap items-center justify-center p-1 rounded-full bg-zinc-50 border border-zinc-200 text-sm">
          <div className="flex items-center">
            <img
              className="size-6 md:size-7 rounded-full border-2 border-white"
              src="https://images.unsplash.com/photo-1633332755192-727a05c4013d?q=80&w=50"
              alt="userImage1"
            />
            <img
              className="size-6 md:size-7 rounded-full border-2 border-white -translate-x-2"
              src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=50"
              alt="userImage2"
            />
            <img
              className="size-6 md:size-7 rounded-full border-2 border-white -translate-x-4"
              src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=50&h=50&auto=format&fit=crop"
              alt="userImage3"
            />
          </div>

          <p className="-translate-x-2 font-medium text-zinc-700">
            Join community of 1m+ founders
          </p>
        </div>

        <h1 className="text-4xl md:text-5xl md:leading-[60px] font-semibold max-w-xl mt-5">
          Unlock your next big opportunity.
        </h1>

        <button
          className="px-8 py-3 text-white bg-orange-600 hover:bg-orange-700 transition-all rounded-full uppercase text-sm mt-8"
          type="button"
          onClick={() => window.open("https://discord.com/", "_blank")}
        >
          Join Discord
        </button>
      </div>
    </>
  );
}