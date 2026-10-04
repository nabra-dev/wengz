"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Sparkles, Zap } from "lucide-react";

const CAROUSEL_IMAGES = Array.from({ length: 31 }, (_, i) => ({
  id: i + 1,
  src: `/images/landing/gallery/${i + 1}.webp`,
  alt: `Portfolio image ${i + 1}`,
}));

export function ImageCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoplay, setIsAutoplay] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [direction, setDirection] = useState(0);

  const paginate = (newDirection: number) => {
    setDirection(newDirection);
    setCurrentIndex(
      (prev) => (prev + newDirection + CAROUSEL_IMAGES.length) % CAROUSEL_IMAGES.length
    );
    setIsAutoplay(false);
  };

  useEffect(() => {
    if (!isAutoplay || isHovered) return;

    const interval = setInterval(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % CAROUSEL_IMAGES.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [isAutoplay, isHovered]);

  useEffect(() => {
    if (!isHovered) {
      const timer = setTimeout(() => setIsAutoplay(true), 8000);
      return () => clearTimeout(timer);
    }
  }, [isHovered]);

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0,
      scale: 0.5,
      rotateY: direction > 0 ? 45 : -45,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1,
      rotateY: 0,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0,
      scale: 0.5,
      rotateY: direction < 0 ? 45 : -45,
    }),
  };

  return (
    <section
      className="relative w-full py-24 overflow-hidden bg-gradient-to-b from-background via-background/50 to-background"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label="Image carousel showcase"
    >
      {/* Animated Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent opacity-50" />
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="container max-w-7xl relative z-10">
        {/* Enhanced Header */}
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center mb-20"
        >
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            whileInView={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="inline-flex items-center gap-2 mb-6 px-6 py-3 bg-gradient-to-r from-primary/20 via-purple-500/20 to-pink-500/20 border border-primary/30 rounded-full backdrop-blur-xl"
          >
            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
            <span className="text-sm font-bold bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
              Portfolio Showcase
            </span>
            <Zap className="w-5 h-5 text-purple-500 animate-pulse" />
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-6xl md:text-7xl lg:text-8xl font-black mb-6 leading-none"
          >
            <span className="block mb-3 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Stunning
            </span>
            <span className="block bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent animate-gradient">
              Creations
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed"
          >
            Discover extraordinary projects crafted by our elite network of creative professionals
          </motion.p>
        </motion.div>

        {/* Main Carousel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="relative"
        >
          {/* Carousel Container with Enhanced 3D Perspective */}
          <div className="relative h-[450px] md:h-[600px] flex items-center justify-center">
            {/* Glow Effect Behind Image */}
            <motion.div
              className="absolute inset-0 mx-auto w-[90%] md:w-[70%] h-[80%] bg-gradient-to-r from-primary via-purple-500 to-pink-500 rounded-3xl blur-3xl opacity-20"
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.2, 0.3, 0.2],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />

            {/* Image Slider */}
            <div
              className="relative w-full h-full flex items-center justify-center"
              style={{ perspective: "2000px" }}
            >
              <AnimatePresence initial={false} custom={direction} mode="popLayout">
                <motion.div
                  key={currentIndex}
                  custom={direction}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    x: { type: "spring", stiffness: 300, damping: 40 },
                    opacity: { duration: 0.3 },
                    scale: { duration: 0.4 },
                    rotateY: { duration: 0.4 },
                  }}
                  className="absolute w-[90%] md:w-[70%] h-[90%] md:h-[85%]"
                  style={{ transformStyle: "preserve-3d" }}
                >
                  {/* Glass Card Container */}
                  <motion.div
                    className="relative w-full h-full rounded-3xl overflow-hidden"
                    whileHover={{ scale: 1.02, rotateY: 5 }}
                    transition={{ duration: 0.4 }}
                    style={{ transformStyle: "preserve-3d" }}
                  >
                    {/* Image */}
                    <Image
                      src={CAROUSEL_IMAGES[currentIndex].src}
                      alt={CAROUSEL_IMAGES[currentIndex].alt}
                      fill
                      className="object-cover"
                      priority
                      sizes="(max-width: 768px) 90vw, 70vw"
                    />

                    {/* Multi-layer Glass Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-purple-500/20 mix-blend-overlay" />

                    {/* Animated Border Glow */}
                    <motion.div
                      className="absolute inset-0 rounded-3xl"
                      style={{
                        boxShadow:
                          "inset 0 0 60px rgba(var(--primary), 0.3), 0 0 80px rgba(var(--primary), 0.2)",
                      }}
                      animate={{
                        boxShadow: [
                          "inset 0 0 60px rgba(var(--primary), 0.3), 0 0 80px rgba(var(--primary), 0.2)",
                          "inset 0 0 80px rgba(139, 92, 246, 0.4), 0 0 100px rgba(139, 92, 246, 0.3)",
                          "inset 0 0 60px rgba(var(--primary), 0.3), 0 0 80px rgba(var(--primary), 0.2)",
                        ],
                      }}
                      transition={{ duration: 3, repeat: Infinity }}
                    />

                    {/* Content Overlay */}
                    <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-12">
                      {/* Progress Bar */}
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="absolute top-0 left-0 h-1 bg-gradient-to-r from-primary via-purple-500 to-pink-500"
                      />

                      {/* Image Info */}
                      <motion.div
                        initial={{ y: 50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3, duration: 0.6 }}
                        className="space-y-4"
                      >
                        {/* Counter Badge */}
                        <div className="inline-flex items-center gap-3 px-6 py-3 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl">
                          <div className="flex items-center gap-2">
                            <motion.div
                              className="w-2 h-2 rounded-full bg-green-400"
                              animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                              transition={{ duration: 2, repeat: Infinity }}
                            />
                            <span className="text-white font-bold text-lg">{currentIndex + 1}</span>
                            <span className="text-white/60">/</span>
                            <span className="text-white/80">{CAROUSEL_IMAGES.length}</span>
                          </div>
                        </div>

                        {/* Project Title */}
                        <h3 className="text-3xl md:text-4xl font-bold text-white leading-tight">
                          Creative Project #{currentIndex + 1}
                        </h3>
                      </motion.div>
                    </div>

                    {/* Shine Effect */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12"
                      initial={{ x: "-100%" }}
                      animate={{ x: "200%" }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        repeatDelay: 5,
                        ease: "easeInOut",
                      }}
                    />
                  </motion.div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Enhanced Navigation Buttons */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-4 md:px-8 z-20">
              <motion.button
                onClick={() => paginate(-1)}
                aria-label="Previous image"
                className="group relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-2xl"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary via-purple-500 to-pink-500 rounded-2xl blur-xl opacity-50 group-hover:opacity-100 transition-opacity" />
                <div className="relative w-16 h-16 md:w-20 md:h-20 bg-gradient-to-r from-background/80 via-background/70 to-background/60 backdrop-blur-xl border border-white/20 rounded-2xl flex items-center justify-center group-hover:border-primary/50 transition-all shadow-2xl">
                  <ChevronLeft className="w-8 h-8 text-foreground group-hover:text-primary transition-colors" />
                </div>
              </motion.button>

              <motion.button
                onClick={() => paginate(1)}
                aria-label="Next image"
                className="group relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-2xl"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-pink-500 to-primary rounded-2xl blur-xl opacity-50 group-hover:opacity-100 transition-opacity" />
                <div className="relative w-16 h-16 md:w-20 md:h-20 bg-gradient-to-r from-background/80 via-background/70 to-background/60 backdrop-blur-xl border border-white/20 rounded-2xl flex items-center justify-center group-hover:border-primary/50 transition-all shadow-2xl">
                  <ChevronRight className="w-8 h-8 text-foreground group-hover:text-primary transition-colors" />
                </div>
              </motion.button>
            </div>
          </div>

          {/* Enhanced Dot Navigation */}
          <motion.div
            className="flex justify-center gap-2 mt-16 px-4 overflow-x-auto pb-2"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <div className="flex gap-2 px-6 py-4 bg-background/50 backdrop-blur-xl border border-white/10 rounded-full">
              {CAROUSEL_IMAGES.slice(0, 10).map((image, idx) => (
                <motion.button
                  key={`dot-${image.id}`}
                  onClick={() => {
                    setDirection(idx > currentIndex ? 1 : -1);
                    setCurrentIndex(idx);
                    setIsAutoplay(false);
                  }}
                  className="relative group"
                  whileHover={{ scale: 1.5 }}
                  whileTap={{ scale: 0.9 }}
                >
                  {currentIndex === idx && (
                    <motion.div
                      layoutId="activeDot"
                      className="absolute inset-0 bg-gradient-to-r from-primary via-purple-500 to-pink-500 rounded-full blur-md"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <div
                    className={`relative w-2.5 h-2.5 rounded-full transition-all ${
                      currentIndex === idx
                        ? "bg-gradient-to-r from-primary via-purple-500 to-pink-500 scale-125"
                        : "bg-white/30 group-hover:bg-white/50"
                    }`}
                  />
                </motion.button>
              ))}
              {CAROUSEL_IMAGES.length > 10 && (
                <div className="flex items-center px-2 text-xs text-muted-foreground">
                  +{CAROUSEL_IMAGES.length - 10}
                </div>
              )}
            </div>
          </motion.div>

          {/* Status Indicator */}
          <motion.div
            className="flex justify-center mt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <div className="px-6 py-3 bg-background/80 backdrop-blur-xl border border-white/10 rounded-full flex items-center gap-3">
              {isAutoplay && !isHovered ? (
                <>
                  <motion.div
                    className="w-2.5 h-2.5 rounded-full bg-green-400"
                    animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <span className="text-sm font-semibold text-green-400">Auto-playing</span>
                </>
              ) : (
                <>
                  <div className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                  <span className="text-sm font-semibold text-orange-400">
                    {isHovered ? "Paused" : "Manual"}
                  </span>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>

        {/* Enhanced Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mt-20"
        >
          {[
            { label: "Portfolio Items", value: "31+", icon: "🎨" },
            { label: "Quality Score", value: "100%", icon: "⭐" },
            { label: "Expert Creators", value: "500+", icon: "👥" },
            { label: "Happy Clients", value: "4.9★", icon: "💎" },
          ].map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.6 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.05, y: -5 }}
              className="relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-purple-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative p-6 md:p-8 bg-background/50 backdrop-blur-xl border border-white/10 rounded-2xl text-center group-hover:border-primary/30 transition-all">
                <div className="text-4xl mb-3">{stat.icon}</div>
                <motion.div
                  className="text-3xl md:text-4xl font-black mb-2 bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent"
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  transition={{ delay: idx * 0.1 + 0.2, type: "spring", stiffness: 200 }}
                >
                  {stat.value}
                </motion.div>
                <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
