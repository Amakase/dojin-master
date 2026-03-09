class Booth < ApplicationRecord
  belongs_to :event
  belongs_to :circle
  has_many :booth_works, dependent: :destroy
  has_many :favorites, dependent: :destroy
  has_many :notifications, dependent: :destroy
  has_one_attached :image

  validates :booth_day, presence: true
  validates :booth_space, presence: true
  validates :genre, presence: true, allow_blank: true
  after_commit :expire_event_booths_cache
  def favorited_by?(user)
    favorites.exists?(user: user)
  end

  def day_number
    (booth_day - event.start_date).to_i + 1
  end

  private

  def expire_event_booths_cache
    Rails.cache.delete(["event", event_id, "booths_v2"])

    return unless respond_to?(:saved_change_to_event_id?) && saved_change_to_event_id?

    previous_event_id, _new_event_id = saved_change_to_event_id
    return unless previous_event_id && previous_event_id != event_id

    endRails.cache.delete(["event", previous_event_id, "booths_v2"])
  end
end
