class User < ApplicationRecord
  # Include default devise modules. Others available are:
  # :confirmable, :lockable, :timeoutable, :trackable and :omniauthable
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable

  has_many :bookmarked_events, dependent: :destroy
  has_many :events, through: :bookmarked_events
  has_many :collections, dependent: :destroy
  has_many :collection_works, through: :collections
  has_many :works, through: :collection_works
  has_many :favorites, dependent: :destroy
  has_many :booths, through: :favorites

  validates :username, presence: true
  validates :date_of_birth, presence: true
end
