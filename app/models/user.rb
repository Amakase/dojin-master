class User < ApplicationRecord
  # Include default devise modules. Others available are:
  # :confirmable, :lockable, :timeoutable, :trackable and :omniauthable
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable

  validates :first_name, presence: true
  validates :last_name, presence: true

  has_many :collections, dependent: :destory
  has_many :events, dependent: :destroy
  has_many :favorites, dependent: :destroy

  has_many :works, through: :collections
  has_many :booths, through: :favorites
end
