import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchPublicGoogleReviews } from '../api/client';

const desktopReviewsPerPage = 2;
const mobileReviewsPerPage = 1;
const reviewPreviewLimit = 230;

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false
  ));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;

    const mediaQuery = window.matchMedia(query);
    const updateMatches = (event) => setMatches(event.matches);
    setMatches(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateMatches);
      return () => mediaQuery.removeEventListener('change', updateMatches);
    }

    mediaQuery.addListener(updateMatches);
    return () => mediaQuery.removeListener(updateMatches);
  }, [query]);

  return matches;
}

function GoogleMark({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="-3 0 262 262"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027" fill="#4285f4" />
      <path d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1" fill="#34a853" />
      <path d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602l42.356-32.782" fill="#fbbc05" />
      <path d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251" fill="#ea4335" />
    </svg>
  );
}

function ArrowIcon({ direction }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={direction === 'previous' ? 'm14.5 5-7 7 7 7' : 'm9.5 5 7 7-7 7'} />
    </svg>
  );
}

function ReviewStars({ rating, compact = false }) {
  const numericRating = Math.min(Math.max(Number(rating) || 0, 0), 5);
  const filledStars = Math.round(numericRating);
  const accessibleRating = compact ? numericRating.toFixed(1) : String(filledStars);

  return (
    <span className={`google-review-stars ${compact ? 'is-compact' : ''}`} aria-label={`${accessibleRating} out of 5 stars`}>
      <span aria-hidden="true">
        {'★'.repeat(filledStars)}
        <span className="google-review-stars-empty">{'★'.repeat(5 - filledStars)}</span>
      </span>
    </span>
  );
}

function normalizeText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function shortenText(value, limit = reviewPreviewLimit) {
  if (value.length <= limit) return value;

  const initialText = value.slice(0, limit + 1);
  const lastSpace = initialText.lastIndexOf(' ');
  const shortened = initialText.slice(0, lastSpace > limit * 0.65 ? lastSpace : limit);
  return `${shortened.replace(/[\s,.;:!?-]+$/u, '')}…`;
}

function formatRelativeTime(timestamp) {
  const numericTimestamp = Number(timestamp || 0);
  if (!numericTimestamp) return '';

  const timestampInMilliseconds = numericTimestamp > 100000000000 ? numericTimestamp : numericTimestamp * 1000;
  const elapsedSeconds = Math.max(0, Math.round((Date.now() - timestampInMilliseconds) / 1000));
  const intervals = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];

  for (const [unit, seconds] of intervals) {
    if (elapsedSeconds >= seconds) {
      const amount = Math.floor(elapsedSeconds / seconds);
      return `${amount} ${unit}${amount === 1 ? '' : 's'} ago`;
    }
  }

  return 'Just now';
}

function normalizePayload(payload) {
  const payloadData = payload?.data ?? payload;
  const result = payloadData?.result ?? payloadData ?? {};
  const summary = result?.summary ?? payloadData?.summary ?? result;
  const sourceReviews = result?.reviews ?? payloadData?.reviews ?? [];

  const reviews = (Array.isArray(sourceReviews) ? sourceReviews : [])
    .map((review, index) => {
      const text = normalizeText(review?.text ?? review?.review_text ?? review?.comment);
      const authorName = normalizeText(review?.author_name ?? review?.author?.name ?? review?.author ?? review?.name)
        || 'Google reviewer';
      const branch = normalizeText(
        review?.messara_branch
          ?? review?.branch_label
          ?? review?.branch?.label
          ?? review?.branch?.name
          ?? review?.branch
      );
      const timestamp = Number(review?.time ?? review?.timestamp ?? review?.published_at_timestamp ?? 0);
      const relativeTime = normalizeText(
        review?.relative_time_description
          ?? review?.relative_time
          ?? review?.time_description
          ?? review?.published_at_relative
      ) || formatRelativeTime(timestamp);

      return {
        id: String(review?.id ?? review?.review_id ?? `${review?.place_id ?? branch}-${timestamp}-${authorName}-${index}`),
        authorName,
        branch,
        rating: Math.min(Math.max(Number(review?.rating) || 0, 0), 5),
        relativeTime,
        text,
        timestamp,
      };
    })
    .filter((review) => review.text)
    .sort((first, second) => second.timestamp - first.timestamp);

  return {
    name: normalizeText(summary?.name ?? result?.name) || 'Messara Living',
    rating: Math.min(Math.max(Number(
      summary?.rating
        ?? summary?.average_rating
        ?? result?.rating
        ?? result?.average_rating
        ?? 0
    ), 0), 5),
    total: Math.max(Number(
      summary?.user_ratings_total
        ?? summary?.total_reviews
        ?? summary?.review_count
        ?? result?.user_ratings_total
        ?? result?.total_reviews
        ?? result?.review_count
        ?? 0
    ), 0),
    reviews,
  };
}

function getInitials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'G';
}

function chunkReviews(reviews, reviewsPerPage) {
  const pages = [];
  for (let index = 0; index < reviews.length; index += reviewsPerPage) {
    pages.push(reviews.slice(index, index + reviewsPerPage));
  }
  return pages;
}

export default function GoogleReviewsSection() {
  const isMobile = useMediaQuery('(max-width: 720px)');
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const reviewsPerPage = isMobile ? mobileReviewsPerPage : desktopReviewsPerPage;
  const previousReviewsPerPageRef = useRef(reviewsPerPage);
  const touchStartXRef = useRef(null);
  const [reviewsData, setReviewsData] = useState({ name: 'Messara Living', rating: 0, total: 0, reviews: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activePage, setActivePage] = useState(0);
  const [expandedReviews, setExpandedReviews] = useState(() => new Set());
  const [isHovering, setIsHovering] = useState(false);
  const [hasFocusWithin, setHasFocusWithin] = useState(false);
  const [isTouching, setIsTouching] = useState(false);
  const [isDocumentVisible, setIsDocumentVisible] = useState(() => (
    typeof document === 'undefined' || document.visibilityState !== 'hidden'
  ));
  const [autoplayStopped, setAutoplayStopped] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    async function loadReviews() {
      setLoading(true);
      setLoadError('');

      try {
        const payload = await fetchPublicGoogleReviews();
        if (isCurrent) setReviewsData(normalizePayload(payload));
      } catch {
        if (isCurrent) setLoadError('Google reviews are temporarily unavailable.');
      } finally {
        if (isCurrent) setLoading(false);
      }
    }

    loadReviews();
    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    function updateVisibility() {
      setIsDocumentVisible(document.visibilityState !== 'hidden');
    }

    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  const reviewPages = useMemo(
    () => chunkReviews(reviewsData.reviews, reviewsPerPage),
    [reviewsData.reviews, reviewsPerPage]
  );

  useEffect(() => {
    const previousReviewsPerPage = previousReviewsPerPageRef.current;
    previousReviewsPerPageRef.current = reviewsPerPage;

    setActivePage((currentPage) => {
      const firstVisibleReview = currentPage * previousReviewsPerPage;
      const nextPage = Math.floor(firstVisibleReview / reviewsPerPage);
      return Math.min(nextPage, Math.max(reviewPages.length - 1, 0));
    });
  }, [reviewPages.length, reviewsPerPage]);

  const autoplayPaused = autoplayStopped
    || isHovering
    || hasFocusWithin
    || isTouching
    || !isDocumentVisible
    || prefersReducedMotion;

  useEffect(() => {
    if (reviewPages.length < 2 || autoplayPaused) return undefined;

    const intervalId = window.setInterval(() => {
      setActivePage((currentPage) => (currentPage + 1) % reviewPages.length);
    }, 6000);

    return () => window.clearInterval(intervalId);
  }, [activePage, autoplayPaused, reviewPages.length]);

  function showPreviousPage() {
    setActivePage((currentPage) => (currentPage - 1 + reviewPages.length) % reviewPages.length);
  }

  function showNextPage() {
    setActivePage((currentPage) => (currentPage + 1) % reviewPages.length);
  }

  function toggleReview(reviewId) {
    setExpandedReviews((currentReviews) => {
      const nextReviews = new Set(currentReviews);
      if (nextReviews.has(reviewId)) nextReviews.delete(reviewId);
      else nextReviews.add(reviewId);
      return nextReviews;
    });
  }

  function handleFocusOut(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) setHasFocusWithin(false);
  }

  function handleTouchStart(event) {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
    setIsTouching(true);
  }

  function handleTouchEnd(event) {
    const touchEndX = event.changedTouches[0]?.clientX;
    const touchStartX = touchStartXRef.current;
    touchStartXRef.current = null;
    setIsTouching(false);

    if (typeof touchEndX !== 'number' || typeof touchStartX !== 'number') return;
    const distance = touchEndX - touchStartX;
    if (Math.abs(distance) < 45 || reviewPages.length < 2) return;
    if (distance > 0) showPreviousPage();
    else showNextPage();
  }

  const roundedSummaryRating = Number(reviewsData.rating || 0).toFixed(1);

  return (
    <section
      id="google-reviews"
      className="section google-reviews-section"
      aria-labelledby="google-reviews-title"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onFocusCapture={() => setHasFocusWithin(true)}
      onBlurCapture={handleFocusOut}
    >
      <div className="google-reviews-panel">
        <header className="google-reviews-header">
          <div className="google-reviews-heading">
            <span className="section-kicker">Customer stories</span>
            <h2 id="google-reviews-title">Loved in homes across the UAE.</h2>
            <p>Real experiences from customers who visited our Dubai and Sharjah showrooms.</p>
          </div>

          <div className="google-reviews-summary" aria-label="Google review summary">
            <div className="google-reviews-summary-source">
              <GoogleMark className="google-reviews-summary-logo" />
              <span>Google reviews</span>
            </div>
            {reviewsData.rating > 0 ? (
              <>
                <div className="google-reviews-summary-rating">
                  <strong>{roundedSummaryRating}</strong>
                  <ReviewStars rating={reviewsData.rating} compact />
                </div>
                {reviewsData.total > 0 && <small>{reviewsData.total.toLocaleString()} reviews on Google</small>}
              </>
            ) : (
              <small>Customer feedback on Google</small>
            )}
          </div>
        </header>

        {loading ? (
          <div className="google-reviews-loading" aria-live="polite" aria-busy="true">
            <span className="google-reviews-visually-hidden">Loading Google reviews</span>
            {Array.from({ length: 2 }, (_, index) => (
              <div key={index} className="google-review-card google-review-card-skeleton" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="google-reviews-status" role="status">
            <GoogleMark className="google-reviews-status-logo" />
            <span>{loadError}</span>
          </div>
        ) : reviewPages.length === 0 ? (
          <div className="google-reviews-status" role="status">
            <GoogleMark className="google-reviews-status-logo" />
            <span>Customer reviews will appear here soon.</span>
          </div>
        ) : (
          <>
            <div
              className="google-reviews-viewport"
              aria-roledescription="carousel"
              aria-label={`${reviewsData.name} Google reviews`}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={() => {
                touchStartXRef.current = null;
                setIsTouching(false);
              }}
            >
              <div
                className="google-reviews-track"
                style={{ transform: `translateX(-${activePage * 100}%)` }}
              >
                {reviewPages.map((pageReviews, pageIndex) => (
                  <div
                    key={pageReviews.map((review) => review.id).join('|')}
                    className="google-reviews-page"
                    role="group"
                    aria-roledescription="slide"
                    aria-label={`Review page ${pageIndex + 1} of ${reviewPages.length}`}
                    aria-hidden={pageIndex !== activePage}
                  >
                    {pageReviews.map((review, reviewIndex) => {
                      const isExpanded = expandedReviews.has(review.id);
                      const previewText = shortenText(review.text);
                      const hasMore = previewText !== review.text;
                      const textId = `google-review-text-${pageIndex}-${reviewIndex}`;

                      return (
                        <article key={review.id} className="google-review-card">
                          <div className="google-review-card-top">
                            <span className="google-review-source">
                              <GoogleMark className="google-review-source-logo" />
                              <span>Google</span>
                            </span>
                            <ReviewStars rating={review.rating} />
                          </div>

                          <div className="google-review-quote" aria-hidden="true">“</div>
                          <p id={textId} className="google-review-copy">
                            {isExpanded ? review.text : previewText}
                          </p>
                          {hasMore && (
                            <button
                              type="button"
                              className="google-review-read-more"
                              aria-expanded={isExpanded}
                              aria-controls={textId}
                              tabIndex={pageIndex === activePage ? 0 : -1}
                              onClick={() => toggleReview(review.id)}
                            >
                              {isExpanded ? 'Read less' : 'Read more'}
                            </button>
                          )}

                          <footer className="google-review-author">
                            <span className="google-review-avatar" aria-hidden="true">{getInitials(review.authorName)}</span>
                            <span className="google-review-author-copy">
                              <strong>{review.authorName}</strong>
                              <span>
                                {review.branch && <em>{review.branch}</em>}
                                {review.relativeTime && <small>{review.relativeTime}</small>}
                              </span>
                            </span>
                          </footer>
                        </article>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {reviewPages.length > 1 && (
              <div className="google-reviews-controls">
                <div className="google-reviews-arrows">
                  <button type="button" onClick={showPreviousPage} aria-label="Show previous Google reviews">
                    <ArrowIcon direction="previous" />
                  </button>
                  <button type="button" onClick={showNextPage} aria-label="Show next Google reviews">
                    <ArrowIcon direction="next" />
                  </button>
                  {!prefersReducedMotion && (
                    <button
                      type="button"
                      className="google-reviews-autoplay"
                      onClick={() => setAutoplayStopped((isStopped) => !isStopped)}
                      aria-label={autoplayStopped ? 'Resume Google review autoplay' : 'Pause Google review autoplay'}
                      aria-pressed={autoplayStopped}
                    >
                      <span aria-hidden="true">{autoplayStopped ? '▶' : 'Ⅱ'}</span>
                    </button>
                  )}
                </div>

                <div className="google-reviews-dots" role="group" aria-label="Choose a Google review page">
                  {reviewPages.map((pageReviews, pageIndex) => {
                    const firstReviewNumber = pageIndex * reviewsPerPage + 1;
                    const lastReviewNumber = firstReviewNumber + pageReviews.length - 1;
                    const reviewRange = firstReviewNumber === lastReviewNumber
                      ? `${firstReviewNumber}`
                      : `${firstReviewNumber} to ${lastReviewNumber}`;

                    return (
                      <button
                        key={pageReviews.map((review) => review.id).join('|')}
                        type="button"
                        className={pageIndex === activePage ? 'is-active' : ''}
                        onClick={() => setActivePage(pageIndex)}
                        aria-label={`Show reviews ${reviewRange}`}
                        aria-current={pageIndex === activePage ? 'true' : undefined}
                      />
                    );
                  })}
                </div>

                <span
                  className="google-reviews-page-count"
                  aria-live={autoplayPaused ? 'polite' : 'off'}
                  aria-atomic="true"
                >
                  {activePage + 1} / {reviewPages.length}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
